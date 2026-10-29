# Picture In Picture

Share a screen, window, or browser tab and pop it out into a floating
Picture-in-Picture (PiP) window that stays on top of your other apps. The page
has controls for the capture, so you don't need to go back to the source tab.

## What it does

| Control | What it does |
| --- | --- |
| **Start** | Opens the browser's screen picker (`getDisplayMedia`, with audio requested). |
| **Open PiP / Close PiP** | Opens the captured video in a PiP window, or closes it. Closing PiP keeps the capture running. |
| **Mute / Unmute** | Toggles the captured audio. Starts **muted** so the shared tab's audio isn't heard twice. Disabled if no audio track was captured. |
| **Pause / Resume** | Pauses the preview. The PiP window shows the same frozen frame. |
| **Stop** | Stops every captured track, closes PiP if it's open, and resets the page. |

Play, pause, and stop are also registered with the
[Media Session API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API),
so the PiP window's own controls (and hardware media keys, where the browser
forwards them) drive the same actions. Status and error messages show up
below the buttons and are announced to screen readers.

Starting the capture and opening PiP take two separate clicks on purpose.
Each API needs a fresh user gesture, and the screen picker can use up the
gesture before PiP gets a chance to use it.

## Running it

`getDisplayMedia` only works in a
[secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts)
(HTTPS or `localhost`), so opening `index.html` straight from the file system
won't work. From the project folder, serve it locally:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>. You don't need a build step or any dependencies.

## Browser support

Check MDN for current details:

- [`HTMLVideoElement.requestPictureInPicture()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestPictureInPicture)
- [`MediaDevices.getDisplayMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)
- [`MediaSession.setActionHandler()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaSession/setActionHandler)

In brief:

- **Chrome / Edge (desktop):** everything is supported. Audio capture depends
  on the source and OS: tab audio is the most reliable, and whole-screen system
  audio works on Windows and ChromeOS.
- **Safari (macOS):** supports both PiP and screen capture, but doesn't
  capture audio, so the Mute button stays disabled.
- **Firefox:** supports screen capture but not `requestPictureInPicture()`.
  Firefox has its own PiP toggle instead, so this page disables its controls
  and explains why.
- **Mobile browsers:** generally don't support `getDisplayMedia`.

## Manual test checklist

Serve the page over `localhost` and run through these in a Chromium-based browser:

- [ ] **Load:** the status line says to click Start. Only Start is enabled.
- [ ] **Keyboard:** Tab moves through the buttons and shows a visible focus ring.
- [ ] **Start, then cancel the picker:** the status says the capture was cancelled or blocked. Start is still enabled.
- [ ] **Start with a tab that's playing audio (with "Share tab audio" checked):** the status says audio was captured and is muted. Open PiP, Mute, Pause and Stop become enabled. You don't hear the audio twice.
- [ ] **Start with a window (no audio):** the status says no audio track was captured, and Mute stays disabled.
- [ ] **Open PiP:** a floating window shows the capture, and the button changes to "Close PiP".
- [ ] **Unmute / Mute:** the captured audio plays from this page and then stops. The label changes each time.
- [ ] **Pause / Resume:** the preview and the PiP window freeze on the same frame and then resume. The label changes each time.
- [ ] **PiP window play/pause button (if shown):** it pauses and resumes, and the Pause button label stays in sync.
- [ ] **Close the PiP window with its own X:** the capture keeps running, the button goes back to "Open PiP", and the status says PiP was closed.
- [ ] **Stop:** the PiP window closes, the browser's sharing indicator goes away, and only Start is enabled.
- [ ] **Browser's "Stop sharing" bar:** with PiP open, click it. PiP closes, the page resets, and the status says sharing was stopped from the browser.
- [ ] **Unsupported browser (e.g. Firefox):** all buttons are disabled, and the status explains which API is missing.
