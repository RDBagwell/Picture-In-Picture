const videoElement = document.getElementById('video');
const startButton = document.getElementById('start-button');
const pipButton = document.getElementById('pip-button');
const stopButton = document.getElementById('stop-button');
const statusElement = document.getElementById('status');

let mediaStream = null;
// True when the browser silenced the shared tab, so its audio only plays here.
let audioSuppressed = false;
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

function updateControls() {
    const capturing = isCapturing();
    const inPip = document.pictureInPictureElement === videoElement;
    const metadataReady = videoElement.readyState >= HTMLMediaElement.HAVE_METADATA;

    startButton.disabled = capturing;
    stopButton.disabled = !capturing;
    pipButton.disabled = !capturing || !metadataReady;
    pipButton.textContent = inPip ? 'Close PiP' : 'Open PiP';
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
        return 'The shared tab is silenced and its audio plays from here. Use the mute button in the PiP window.';
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

function init() {
    const hasDisplayMedia = Boolean(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
    const hasPip = Boolean(document.pictureInPictureEnabled && videoElement.requestPictureInPicture);

    if (!hasDisplayMedia || !hasPip) {
        [startButton, pipButton, stopButton].forEach((button) => { button.disabled = true; });
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
        try {
            await videoElement.play();
        } catch (error) {
            setStatus(describeError(error, 'Playback'));
        }
        updateControls();
        pipButton.focus();
    });
    // Fires when the mute button in the PiP window is used.
    videoElement.addEventListener('volumechange', () => {
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

    startButton.addEventListener('click', selectMediaStream);
    pipButton.addEventListener('click', togglePictureInPicture);
    stopButton.addEventListener('click', () => stopCapture());

    updateControls();
}

init();
