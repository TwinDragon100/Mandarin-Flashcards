# Installation & Usage Guide

## 1. Open the workspace on macOS
1. Launch Terminal.
2. Change into the project folder:
   ```
   cd /Users/stevenwright/.openclaw/workspace/Mandarin
   ```

## 2. Start a local static server (Python 3)
1. From the project root run:
   ```
   cd app
   python3 -m http.server 4173
   ```
2. Keep this Terminal window open; it serves the app at `http://localhost:4173/`.

## 3. View the PWA on macOS Safari
1. Open Safari.
2. Visit `http://localhost:4173/index.html`.
3. To install the PWA in Safari 17+:
   - Go to the Share menu.
   - Choose **Add to Dock**.
   - Confirm the name and click **Add**.

## 4. Load and install on iPhone (Safari)
1. Ensure your Mac and iPhone are on the same network.
2. On iPhone, open Safari and visit `http://<your-mac-ip>:4173/index.html` (find IP via `System Settings ▸ Network`).
3. Tap the Share icon, then **Add to Home Screen**.
4. Confirm the icon name and tap **Add**. The app is now available offline.

## 5. Editing files with nano
1. In Terminal, open any file (example: `app/index.html`):
   ```
   nano /Users/stevenwright/.openclaw/workspace/Mandarin/app/index.html
   ```
2. Make edits, then press `Ctrl + O` to write, `Enter` to confirm, and `Ctrl + X` to exit.

## 6. Stopping the server
1. Return to the Terminal window running `python3 -m http.server`.
2. Press `Ctrl + C` to stop the server.

## 7. Troubleshooting
- If Safari fails to load, ensure the server is running and the URL is correct.
- For iPhone access, confirm the device can reach your Mac’s IP and that macOS firewall allows incoming connections for Python.
