const videoElement = document.getElementById('video');
const startButton = document.getElementById('start-button');
const pipButton = document.getElementById('pip-button');
const muteButton = document.getElementById('mute-button');
const pauseButton = document.getElementById('pause-button');
const stopButton = document.getElementById('stop-button');
const statusElement = document.getElementById('status');

const allButtons = [startButton, pipButton, muteButton, pauseButton, stopButton];
const hasMediaSession = 'mediaSession' in navigator;

let mediaStream = null;

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

// Labels are derived from the video element so that changes made from the
// PiP window's own controls are reflected here too.
function updateControls() {
    const capturing = isCapturing();
    const hasAudio = capturing && mediaStream.getAudioTracks().length > 0;
    const inPip = document.pictureInPictureElement === videoElement;
    const metadataReady = videoElement.readyState >= HTMLMediaElement.HAVE_METADATA;

    startButton.disabled = capturing;
    stopButton.disabled = !capturing;

    pipButton.disabled = !capturing || !metadataReady;
    pipButton.textContent = inPip ? 'Close PiP' : 'Open PiP';

    muteButton.disabled = !hasAudio;
    muteButton.textContent = videoElement.muted ? 'Unmute' : 'Mute';

    pauseButton.disabled = !capturing;
    pauseButton.textContent = capturing && videoElement.paused ? 'Resume' : 'Pause';

    if (hasMediaSession) {
        navigator.mediaSession.playbackState = !capturing
            ? 'none'
            : (videoElement.paused ? 'paused' : 'playing');
    }
}

function resetUI(message) {
    videoElement.srcObject = null;
    videoElement.muted = true;
    updateControls();
    setStatus(message);
    startButton.focus();
}

async function selectMediaStream() {
    try {
        mediaStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
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

    // Muted by default so the shared tab's audio is not heard twice.
    videoElement.muted = true;
    videoElement.srcObject = mediaStream;
    updateControls();

    const audioNote = mediaStream.getAudioTracks().length > 0
        ? 'Audio was captured and is muted.'
        : 'No audio track was captured (the source or browser may not support audio sharing).';
    setStatus(`Capturing. ${audioNote} Click Open PiP to pop out the video.`);
}

async function stopCapture(message = 'Capture stopped.') {
    const stream = mediaStream;
    mediaStream = null;
    if (stream) {
        stream.getTracks().forEach((track) => track.stop());
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

async function togglePictureInPicture() {
    try {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
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
    const hasPip = Boolean(document.pictureInPictureEnabled && videoElement.requestPictureInPicture);

    if (!hasDisplayMedia || !hasPip) {
        allButtons.forEach((button) => { button.disabled = true; });
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
    videoElement.addEventListener('volumechange', updateControls);
    videoElement.addEventListener('enterpictureinpicture', updateControls);
    videoElement.addEventListener('leavepictureinpicture', () => {
        updateControls();
        if (isCapturing()) {
            setStatus('Picture-in-Picture closed. Capture is still running.');
        }
    });

    startButton.addEventListener('click', selectMediaStream);
    pipButton.addEventListener('click', togglePictureInPicture);
    muteButton.addEventListener('click', () => {
        videoElement.muted = !videoElement.muted;
        setStatus(videoElement.muted ? 'Audio muted.' : 'Audio unmuted.');
    });
    pauseButton.addEventListener('click', () => {
        if (videoElement.paused) {
            playVideo();
            setStatus('Preview resumed.');
        } else {
            pauseVideo();
            setStatus('Preview paused.');
        }
    });
    stopButton.addEventListener('click', () => stopCapture());

    setupMediaSession();
    updateControls();
}

init();
