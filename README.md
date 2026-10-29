# Picture In Picture

Share a screen, window, or browser tab and pop it out into a floating
Picture-in-Picture (PiP) window that stays on top of your other apps. The page
has controls for the capture, so you don't need to go back to the source tab.

## What it does

| Control | What it does |
| --- | --- |
| **Start** | Opens the browser's screen picker (`getDisplayMedia`, with audio requested). |
| **Open PiP / Close PiP** | Opens the captured video in a floating window, or closes it. Closing PiP keeps the capture running. |
| **Mute / Unmute** | Toggles the captured audio. Disabled if no audio track was captured. See "Audio" below for the default. |
| **Pause / Resume** | Freezes the preview on the current frame. It does **not** pause the source. See "Pause" below. |
| **Stop** | Stops every captured track, closes PiP if it's open, and resets the page. |

### The floating window

In Chrome and Edge the floating window uses
[Document Picture-in-Picture](https://developer.mozilla.org/en-US/docs/Web/API/Document_Picture-in-Picture_API),
so it has its own **Mute**, **Pause** and **Stop** buttons under the video.
Chrome's regular video PiP window hides play/pause for live captures.

In browsers without Document PiP (e.g. Safari), the page falls back to the
regular video PiP window. Play, pause and stop are registered with the
[Media Session API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API)
for that window, but the browser decides whether to show those buttons.

### Audio

The page asks Chrome to silence the shared tab (`suppressLocalAudioPlayback`)
so its audio is only heard from this page:

- **Sharing a tab with "Share tab audio" on:** the tab goes quiet and the
  audio plays from here, **unmuted**. Mute and Pause control what you hear,
  with no echo.
- **Sharing a window or the whole screen:** the browser can't silence the
  source, so the audio starts **muted**. Unmuting plays a second copy (an echo),
  and the status line warns you.

### Pause

A web page can't pause a video in another tab; the browser blocks that on
purpose. Pause freezes the preview (and, for a silenced tab, its sound), but
the shared tab keeps playing. Resume jumps to whatever the source is showing
now. To actually pause the video, use the source's own controls or its
built-in PiP if it has one.

Status and error messages show up below the buttons and are announced to
screen readers.

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
- [`DocumentPictureInPicture.requestWindow()`](https://developer.mozilla.org/en-US/docs/Web/API/DocumentPictureInPicture/requestWindow)
- [`MediaDevices.getDisplayMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)
- [`suppressLocalAudioPlayback`](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/suppressLocalAudioPlayback)
- [`MediaSession.setActionHandler()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaSession/setActionHandler)

In brief:

- **Chrome / Edge (desktop):** everything is supported, including the floating
  window's own buttons and silencing a shared tab. Audio capture depends on the
  source and OS: tab audio is the most reliable.
- **Safari (macOS):** screen capture and the regular video PiP window. No audio
  is captured, so the Mute button stays disabled.
- **Firefox:** supports screen capture but neither kind of page-triggered PiP.
  Firefox has its own PiP toggle instead, so this page disables its controls
  and explains why.
- **Mobile browsers:** generally don't support `getDisplayMedia`.

## Manual test checklist

Serve the page over `localhost` and run through these in a Chromium-based browser:

- [ ] **Load:** the status line says to click Start. Only Start is enabled.
- [ ] **Keyboard:** Tab moves through the buttons and shows a visible focus ring.
- [ ] **Start, then cancel the picker:** the status says the capture was cancelled or blocked. Start is still enabled.
- [ ] **Start with a tab that's playing audio (with "Share tab audio" checked):** the status says the shared tab is silenced. You hear the audio once, from this page, and the Mute button reads "Mute".
- [ ] **Start with the whole screen (with system audio, where offered):** the status says audio is muted because it would echo, and the Mute button reads "Unmute". Unmuting warns about the echo.
- [ ] **Start with a window (no audio):** the status says no audio track was captured, and Mute stays disabled.
- [ ] **Open PiP:** a floating window shows the capture with Mute, Pause and Stop buttons under it, and the page's button changes to "Close PiP".
- [ ] **Mute / Pause in the floating window:** each works, and the labels on the page change to match.
- [ ] **Mute / Pause on the page:** the floating window's labels change to match.
- [ ] **Pause with a tab share:** the picture freezes and goes quiet, the source tab keeps playing, and the status explains why. Resume jumps to the live picture.
- [ ] **Stop in the floating window:** the window closes and the page resets.
- [ ] **Close the PiP window with its own X:** the capture keeps running, the button goes back to "Open PiP", and the status says PiP was closed.
- [ ] **Stop:** the PiP window closes, the browser's sharing indicator goes away, and only Start is enabled.
- [ ] **Browser's "Stop sharing" bar:** with PiP open, click it. PiP closes, the page resets, and the status says sharing was stopped from the browser.
- [ ] **Unsupported browser (e.g. Firefox):** all buttons are disabled, and the status explains which API is missing.
