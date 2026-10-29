# Picture In Picture

Share a screen, window, or browser tab and pop it out into a floating
Picture-in-Picture (PiP) window that stays on top of your other apps.

## What it does

| Control | What it does |
| --- | --- |
| **Start** | Opens the browser's screen picker (`getDisplayMedia`, with audio requested). |
| **Open PiP / Close PiP** | Opens the captured video in the browser's PiP window, or closes it. Closing PiP keeps the capture running. |
| **Stop** | Stops every captured track, closes PiP if it's open, and resets the page. |

To mute or unmute, use the browser's own mute button in the PiP window.
Status and error messages show up below the buttons and are announced to
screen readers.

Starting the capture and opening PiP take two separate clicks on purpose.
Each API needs a fresh user gesture, and the screen picker can use up the
gesture before PiP gets a chance to use it.

### Audio

The page asks Chrome to silence the shared tab (`suppressLocalAudioPlayback`)
so its audio is only heard from the PiP window:

- **Sharing a tab with "Share tab audio" on:** the tab goes quiet and the
  audio plays from here, **unmuted**, with no echo.
- **Sharing a window or the whole screen:** the browser can't silence the
  source, so the audio starts **muted**. Unmuting from the PiP window plays a
  second copy (an echo), and the status line warns you.

### No pause

A web page can't pause a video playing in another tab, so there's no Pause
control. Use the source's own controls to pause it.

## Running it

`getDisplayMedia` only works in a
[secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts)
(HTTPS or `localhost`), so opening `index.html` straight from the file system
won't work. From the project folder, serve it locally:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>. You don't need a build step or any
dependencies. It also works as-is on GitHub Pages, which serves over HTTPS.

## Browser support

Check MDN for current details:

- [`HTMLVideoElement.requestPictureInPicture()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestPictureInPicture)
- [`MediaDevices.getDisplayMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)
- [`suppressLocalAudioPlayback`](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/suppressLocalAudioPlayback)

In brief:

- **Chrome / Edge (desktop):** everything is supported, including silencing a
  shared tab. Tab audio is the most reliable audio source.
- **Safari (macOS):** screen capture and PiP work. No audio is captured.
- **Firefox:** supports screen capture but not `requestPictureInPicture()`.
  Firefox has its own PiP toggle instead, so this page disables its controls
  and explains why.
- **Mobile browsers:** generally don't support `getDisplayMedia`.

## Manual test checklist

Serve the page over `localhost` and run through these in a Chromium-based browser:

- [ ] **Load:** the status line says to click Start. Only Start is enabled.
- [ ] **Keyboard:** Tab moves through the buttons and shows a visible focus ring.
- [ ] **Start, then cancel the picker:** the status says the capture was cancelled or blocked. Start is still enabled.
- [ ] **Start with a tab that's playing audio (with "Share tab audio" checked):** the status says the shared tab is silenced. You hear the audio once, with no echo.
- [ ] **Start with the whole screen (with system audio, where offered):** the status says the audio is muted because it would echo. Unmuting from the PiP window shows an echo warning.
- [ ] **Start with a window (no audio):** the status says no audio track was captured.
- [ ] **Open PiP:** the browser's floating window shows the capture, and the button changes to "Close PiP".
- [ ] **Mute in the PiP window:** the audio stops, and the status line says "Audio muted."
- [ ] **Close the PiP window with its own X:** the capture keeps running, the button goes back to "Open PiP", and the status says PiP was closed.
- [ ] **Stop:** the PiP window closes, the browser's sharing indicator goes away, and only Start is enabled.
- [ ] **Browser's "Stop sharing" bar:** with PiP open, click it. PiP closes, the page resets, and the status says sharing was stopped from the browser.
- [ ] **Unsupported browser (e.g. Firefox):** all buttons are disabled, and the status explains which API is missing.
