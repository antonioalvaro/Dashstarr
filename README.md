# Dashstarr

A standalone Mac app for Selkies Docker desktops, using Chrome's engine (Chromium) so Selkies behaves like it does in Chrome. Runs on macOS 12 Monterey and newer, Apple Silicon and Intel.

## Features

- AnyDesk style home screen: type an IP in the top bar and press Enter, or pick a saved server tile
- Tiles show name, address, a live online/offline dot and when you last connected. Double click to connect, right click to edit, duplicate or remove
- One window: a single connection fills the whole window. Open a second one and a tab bar appears (it goes away again when you're back to one)
- Selkies HTTP login popup, with "Remember this login" (encrypted with your macOS Keychain)
- Plain http servers get treated as secure, so Selkies' video decoding works without https (the first connect to a new http address asks for a quick restart)
- Self signed https certificates: asked once, "Always Trust" pins that certificate
- Full screen, mic and webcam, gamepads, clipboard, pointer lock, file downloads to ~/Downloads
- Screen stays awake while a session is open; asks before quitting with sessions open
- Built-in Tailscale (optional): reach servers on your tailnet without the Tailscale app or a system VPN
- App lock (optional): password, or username and password, to open the app, with auto-lock after inactivity and Touch ID

## Build it on your Mac

1. Install **Node.js 22 LTS** from https://nodejs.org (the macOS installer). Node 24 and later need macOS 13 or newer.
2. In Terminal, go to this folder:
   ```bash
   cd ~/Downloads/Dashstarr
   ```
3. Install and build:
   ```bash
   npm install
   ```
   ```bash
   npm run dist
   ```
4. The app is in `dist/mac-universal/Dashstarr.app`. Drag it to Applications.

The first time, right click the app and choose Open (it isn't notarized by Apple). If macOS says it's damaged, run:
```bash
xattr -dr com.apple.quarantine "/Applications/Dashstarr.app"
```

To try it without building: `npm start`

## Icon

The app icon is `build/icon.png` (1024x1024). Replace it and run `npm run dist` again to change it.

## Shortcuts

| Keys | Action |
| --- | --- |
| Cmd+, | Settings (app lock) |
| Cmd+Shift+L | Lock now |
| Cmd+0 | Home screen |
| Cmd+1 to 9 | Jump to connection 1 to 9 |
| Ctrl+Tab / Ctrl+Shift+Tab | Next / previous connection |
| Return / Delete | Connect / remove the selected tile |
| Cmd+R | Reload session |
| Ctrl+Cmd+F | Full screen |
| Alt+Cmd+I | Developer tools (for troubleshooting) |
| Cmd+W | Close the current connection or pop-up window |
| Cmd+Shift+W | Close the window |

View > Forget Saved Login removes the stored password for the current server.

## App lock

Open **Dashstarr > Settings…** (Cmd+,) and turn on **Require a password to open the app**.

- Username is optional. Leave it empty to unlock with just a password.
- **Lock automatically after** locks the app after that many minutes with no keyboard or mouse activity on the Mac.
- You can also lock when the Mac sleeps or the screen locks, unlock with Touch ID, or lock any time with **Lock Now** (Cmd+Shift+L).
- While locked, all windows are hidden and session audio is muted. Your connections keep running, so unlocking puts you right back.
- The password is stored as a salted hash, never in plain text. After 5 wrong tries there's a short wait before you can try again.
- Forgot the password? Quit the app, open `~/Library/Application Support/Dashstarr/settings.json` and delete the `"lock"` entry. This turns the lock off (your servers are kept).

## Tailscale

Click **Tailscale off** in the top right of Home (or **Turn On Tailscale**), then **Log In**. Your browser opens Tailscale's login page; once you approve, this Mac shows up in your tailnet as `dashstarr-<your-mac>`.

- Your tailnet devices appear under **Tailscale Devices**. Click **Add**, type the Selkies port after the colon, and save.
- Only tailnet addresses (`100.x.x.x`, `*.ts.net`, device names) go through Tailscale. Everything else connects normally.
- It runs inside this app only. It doesn't touch your Mac's network settings and works alongside the regular Tailscale app.
- Tip: on the server, `tailscale serve` gives Selkies a real https certificate on its `.ts.net` name.

How it works: `bin/dashstarr-tailscale` is a small helper built from `helper/main.go` with Tailscale's `tsnet` library (the same approach as Tailscale's own browser extension). The app starts it, and it runs a local proxy that needs a random password each launch, so other programs on your Mac can't use it to reach your tailnet. To rebuild the helper yourself you need Go 1.26 or newer: `npm run helper`.

## Why Electron 43

Electron 44 and later need macOS 13, so this stays on Electron 43 for Monterey support.

## License

MIT, see [`LICENSE`](LICENSE).

Dashstarr bundles other open source software under their own licenses, including Electron and Chromium, Tailscale's `tsnet` library (BSD-3-Clause) with its dependencies such as gVisor (Apache-2.0), and the app icon from [Tabler Icons](https://github.com/tabler/tabler-icons) (MIT). Full texts are in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md), and they ship inside the app under `Contents/Resources/licenses/`.

This project isn't affiliated with or endorsed by Selkies or Tailscale.
