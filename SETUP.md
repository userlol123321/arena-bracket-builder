# Local bracket builder and OBS setup

Everything runs on your computer. No accounts, cloud storage, API keys, or sign-in are needed.

## Run on your OBS computer

Install Node.js 20 or newer, download/clone this repository, then run:

```sh
npm install
npm start
```

Open **http://localhost:3000**. Keep the terminal running while using OBS. The server listens only on this computer, not your LAN or the public internet.

## Add a live bracket to OBS

1. Create/import your bracket in the local app.
2. Open the bracket and click **OBS live link → Create live link**.
3. Optionally select **Transparent background**, then **Copy link**.
4. In OBS: **Sources → + → Browser**. Leave **Local file** unchecked and paste the copied URL.
5. Set width **1920** and height **1080**. The bracket fits the source automatically. For very large brackets, use a larger source resolution or crop/zoom in OBS for legibility.
6. Click a ready match in the editor and change scores with the number fields or **− / +** buttons. Scores save immediately and OBS updates in about 1–2 seconds. Closing the score window keeps those live scores without advancing anyone.
7. When the match ends, click **Advance bracket**. This finalizes the result, locks the match, and advances the winner. Elimination matches cannot advance with a tied score. The OBS view has no editing controls and the viewing token cannot authorize edits.

The OBS link works on the **same computer** as the local app. It is not a public sharing URL. GitHub Pages alone cannot relay live data between independent browser sessions without a server; use the local app when streaming.

## Customize your league

- **Color theme** in the sidebar changes the workspace and the default color for newly created brackets.
- **Customize** inside a bracket changes that bracket's theme, league name, and logo. Existing brackets keep their own choices.
- Available palettes: red/black (default), purple, electric blue, emerald, orange, gold, and black/white.
- Logos support PNG, JPG, and WebP up to 3 MB. Transparent PNG is recommended. The app scales logos to a maximum of 256 pixels and embeds them directly in backups and SVG/PNG exports.
- Preview your changes, then click **Apply appearance**. An active OBS viewer picks up the changes automatically. Cancel leaves the saved appearance unchanged.
- Workspace backups include the workspace theme, per-bracket themes, league names, and embedded logos, so no separate image files are needed on another computer.

## Link lifetime

- **Stop sharing** disables the existing link. Creating another link produces a different address.
- **Deleting the bracket** also disables its link.
- **Stopping/restarting the local server** clears all temporary links. Create a fresh link afterward and update OBS.
- Closing the editor leaves the last bracket snapshot available while the server stays running. Reopening the same browser resumes edits.
- If the connection fails, the viewer keeps its last snapshot with a reconnecting notice. When sharing ends, the bracket disappears and the viewer displays “This live link has ended.”
- Temporary stream snapshots are held in memory. Persistent bracket data stays in your editor browser, so stopping the server does not delete your workspace.
- Use one editor tab for a bracket at a time. Multiple editor tabs can overwrite each other's local changes.

## Move to another computer

1. On the original computer, click **Back up workspace** to download `arena-workspace.json`.
2. Transfer that file by USB, email, or your preferred method.
3. Run the app on the other computer and click **Import backup**.

Backups include teams, seeds, formats, scores, and results. Existing brackets with matching IDs are replaced after confirmation. Live links are temporary and are not transferred; create a new one on the new computer. Clearing browser data removes locally saved brackets, so keep backups.

If you previously saved brackets in cloud storage, those existing files are not deleted by this update. Import their JSON backups into the app if you need them locally.

## GitHub Pages

The static site still supports Excel import, bracket editing, exports, and workspace backups without any configuration.

1. Push the project to `main` in your GitHub repository.
2. In **Settings → Pages**, choose **GitHub Actions**.
3. The included workflow tests, builds, and deploys `dist/`.

For an OBS session, export a workspace backup from the website and import it into **http://localhost:3000**. The website and local app have separate browser storage.

## Checks

```sh
npm test
npm run build
npm run test:browser
```

Browser checks use an installed Google Chrome by default; set `BROWSER_CHANNEL` for another supported installed Playwright browser channel. They run on temporary ports with isolated browser contexts, leaving your workspace untouched.
