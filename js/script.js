const videoElement = document.getElementById('video');
const startButton = document.getElementById('start-button');
const pipButton = document.getElementById('pip-button');
const statusElement = document.getElementById('status');

const hasMediaSession = 'mediaSession' in navigator;
const hasDocumentPip = 'documentPictureInPicture' in window;

let mediaStream = null;
// True when the browser silenced the shared tab, so its audio only plays here.
let audioSuppressed = false;
// The Document Picture-in-Picture window, while it is open.
let pipWindow = null;
let announcedMuted = true;

function setStatus(message) {
    statusElement.textContent = message;
}

// Turn a DOMException into something a person can act on.
function describeError(error, action) {
    switch (error.name) {
        case 'NotAllowedError':
            return `${action} was cancelled or blocked.`;
        case 'NotFoundError':
            return `${action} failed: nothing was available to capture.`;
        case 'NotReadableError':
            return `${action} failed: the browser or operating system could not read the source.`;
        case 'InvalidStateError':
            return `${action} failed: the video is not ready yet. Try again in a moment.`;
        case 'SecurityError':
            return `${action} failed: this page must be served over HTTPS or localhost.`;
        default:
            return `${action} failed: ${error.message || error.name}`;
    }
}

function isCapturing() {
    return mediaStream !== null;
}

function isInPip() {
    return pipWindow !== null || document.pictureInPictureElement === videoElement;
}

// The same action can have a button on this page and one in the PiP window.
function buttonsFor(action) {
    const docs = pipWindow ? [document, pipWindow.document] : [document];
    return docs.flatMap((doc) => [...doc.querySelectorAll(`[data-action="${action}"]`)]);
}

function setButtons(action, disabled, label) {
    buttonsFor(action).forEach((button) => {
        button.disabled = disabled;
        if (label) {
            button.textContent = label;
        }
    });
}

// Labels are derived from the video element so that changes made from the
// PiP window's own controls are reflected here too.
function updateControls() {
    const capturing = isCapturing();
    const hasAudio = capturing && mediaStream.getAudioTracks().length > 0;
    const metadataReady = videoElement.readyState >= HTMLMediaElement.HAVE_METADATA;

    setButtons('start', capturing);
    setButtons('stop', !capturing, 'Stop');
    setButtons('pip', !capturing || !metadataReady, isInPip() ? 'Close PiP' : 'Open PiP');
    setButtons('mute', !hasAudio, videoElement.muted ? 'Unmute' : 'Mute');
    setButtons('pause', !capturing, capturing && videoElement.paused ? 'Resume' : 'Pause');

    if (hasMediaSession) {
        navigator.mediaSession.playbackState = !capturing
            ? 'none'
            : (videoElement.paused ? 'paused' : 'playing');
    }
}

function resetUI(message) {
    videoElement.srcObject = null;
    videoElement.muted = true;
    announcedMuted = true;
    audioSuppressed = false;
    updateControls();
    setStatus(message);
    startButton.focus();
}

function describeAudio() {
    if (mediaStream.getAudioTracks().length === 0) {
        return 'No audio track was captured. To include sound, share a tab with "Share tab audio" turned on.';
    }
    if (audioSuppressed) {
        return 'The shared tab is silenced and its audio plays from here, so Mute and Pause control what you hear.';
    }
    return 'Audio was captured but is muted, because the source is still playing it and unmuting would echo.';
}

async function selectMediaStream() {
    try {
        mediaStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            // Chrome: stop the shared tab playing its own audio, so it is only heard from here.
            audio: { suppressLocalAudioPlayback: true },
        });
    } catch (error) {
        mediaStream = null;
        setStatus(describeError(error, 'Screen capture'));
        return;
    }

    // Fires when the user clicks the browser's own "Stop sharing" bar.
    mediaStream.getTracks().forEach((track) => {
        track.addEventListener('ended', () => {
            if (isCapturing()) {
                stopCapture('Sharing was stopped from the browser.');
            }
        });
    });

    // Only play the audio here by default when the source has been silenced;
    // otherwise it would be heard twice. Chrome only silences tab ("browser")
    // captures, so a screen or window share keeps playing its own audio.
    const [audioTrack] = mediaStream.getAudioTracks();
    const [videoTrack] = mediaStream.getVideoTracks();
    audioSuppressed = Boolean(audioTrack)
        && audioTrack.getSettings().suppressLocalAudioPlayback === true
        && videoTrack.getSettings().displaySurface === 'browser';
    videoElement.muted = !audioSuppressed;
    announcedMuted = videoElement.muted;
    videoElement.srcObject = mediaStream;
    updateControls();

    setStatus(`Capturing. ${describeAudio()} Click Open PiP to pop out the video.`);
}

async function stopCapture(message = 'Capture stopped.') {
    const stream = mediaStream;
    mediaStream = null;
    if (stream) {
        stream.getTracks().forEach((track) => track.stop());
    }
    if (pipWindow) {
        pipWindow.close();
    }
    if (document.pictureInPictureElement) {
        try {
            await document.exitPictureInPicture();
        } catch (error) {
            console.error(error);
        }
    }
    resetUI(message);
}

// Document Picture-in-Picture (Chrome/Edge) lets the floating window hold our
// own buttons, which the plain video PiP window does not show for live captures.
async function openDocumentPip() {
    const wasPaused = videoElement.paused;
    const aspect = (videoElement.videoHeight / videoElement.videoWidth) || 9 / 16;
    const width = 640;
    const win = await documentPictureInPicture.requestWindow({
        width,
        height: Math.round(width * aspect) + 64,
    });
    pipWindow = win;

    const stylesheet = win.document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = document.querySelector('link[rel="stylesheet"]').href;
    win.document.head.append(stylesheet);
    win.document.body.classList.add('pip-body');

    const controls = win.document.createElement('div');
    controls.className = 'pip-controls';
    ['mute', 'pause', 'stop'].forEach((action) => {
        const button = win.document.createElement('button');
        button.type = 'button';
        button.dataset.action = action;
        controls.append(button);
    });

    videoElement.hidden = false;
    win.document.body.append(videoElement, controls);
    win.document.addEventListener('click', handleClick);
    win.addEventListener('pagehide', onDocumentPipClosed);

    if (!wasPaused) {
        await playVideo();
    }
    updateControls();
    setStatus('Picture-in-Picture opened. Mute, Pause and Stop are also in the floating window.');
}

function onDocumentPipClosed() {
    const wasPaused = videoElement.paused;
    pipWindow = null;
    videoElement.hidden = true;
    document.body.prepend(videoElement);
    if (isCapturing()) {
        if (!wasPaused) {
            playVideo();
        }
        setStatus('Picture-in-Picture closed. Capture is still running.');
    }
    updateControls();
}

async function togglePictureInPicture() {
    try {
        if (pipWindow) {
            pipWindow.close();
        } else if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else if (hasDocumentPip) {
            await openDocumentPip();
        } else {
            await videoElement.requestPictureInPicture();
        }
    } catch (error) {
        setStatus(describeError(error, 'Picture-in-Picture'));
    }
    updateControls();
}

async function playVideo() {
    if (!isCapturing()) {
        return;
    }
    try {
        await videoElement.play();
    } catch (error) {
        setStatus(describeError(error, 'Playback'));
    }
}

function pauseVideo() {
    if (isCapturing()) {
        videoElement.pause();
    }
}

function togglePause() {
    if (videoElement.paused) {
        playVideo();
        setStatus('Preview resumed. It jumps to whatever the source is showing now.');
    } else {
        pauseVideo();
        setStatus("Preview paused. The shared tab itself keeps playing, because a web page can't pause another tab.");
    }
}

const actions = {
    start: selectMediaStream,
    pip: togglePictureInPicture,
    mute: () => { videoElement.muted = !videoElement.muted; },
    pause: togglePause,
    stop: () => stopCapture(),
};

// One handler serves the buttons on this page and in the PiP window.
function handleClick(event) {
    const button = event.target.closest('[data-action]');
    if (button && !button.disabled) {
        actions[button.dataset.action]();
    }
}

function setupMediaSession() {
    if (!hasMediaSession) {
        return;
    }
    const handlers = {
        play: playVideo,
        pause: pauseVideo,
        stop: () => stopCapture(),
    };
    Object.entries(handlers).forEach(([action, handler]) => {
        try {
            navigator.mediaSession.setActionHandler(action, handler);
        } catch (error) {
            // Older browsers throw for actions they don't know (often "stop").
            console.warn(`Media Session action "${action}" is not supported.`);
        }
    });
}

function init() {
    const hasDisplayMedia = Boolean(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
    const hasPip = hasDocumentPip
        || Boolean(document.pictureInPictureEnabled && videoElement.requestPictureInPicture);

    if (!hasDisplayMedia || !hasPip) {
        document.querySelectorAll('[data-action]').forEach((button) => { button.disabled = true; });
        const missing = [];
        if (!hasDisplayMedia) {
            missing.push(window.isSecureContext
                ? 'screen capture (getDisplayMedia)'
                : 'screen capture (this page must be served over HTTPS or localhost)');
        }
        if (!hasPip) {
            missing.push('Picture-in-Picture for video elements');
        }
        setStatus(`This browser does not support ${missing.join(' or ')}, so the controls are disabled.`);
        return;
    }

    videoElement.muted = true;

    videoElement.addEventListener('loadedmetadata', async () => {
        await playVideo();
        updateControls();
        pipButton.focus();
    });
    videoElement.addEventListener('play', updateControls);
    videoElement.addEventListener('pause', updateControls);
    // Also catches the mute button in the browser's own PiP window.
    videoElement.addEventListener('volumechange', () => {
        updateControls();
        if (isCapturing() && videoElement.muted !== announcedMuted) {
            announcedMuted = videoElement.muted;
            if (videoElement.muted) {
                setStatus('Audio muted.');
            } else if (audioSuppressed) {
                setStatus('Audio unmuted.');
            } else {
                setStatus('Audio unmuted. The source is still playing too, so you may hear an echo.');
            }
        }
    });
    videoElement.addEventListener('enterpictureinpicture', updateControls);
    videoElement.addEventListener('leavepictureinpicture', () => {
        updateControls();
        if (isCapturing()) {
            setStatus('Picture-in-Picture closed. Capture is still running.');
        }
    });

    document.addEventListener('click', handleClick);

    setupMediaSession();
    updateControls();
}

init();
