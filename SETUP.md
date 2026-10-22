# GitHub Pages + personal Google Drive setup

The app is static: GitHub Pages serves the interface, and Google Drive stores one JSON file per bracket in a private **Arena Brackets** folder. Excel remains the input format. Google Sheets and a paid backend are not required.

## 1. Publish on GitHub Pages

1. Create a GitHub repository and upload this project, including `.github/workflows/pages.yml`, `package.json`, and `package-lock.json`. Do not upload `node_modules` or your bracket backups.
2. Use `main` as the default branch (or update the workflow branch).
3. In **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
4. Push to `main`, or run **Actions → Deploy bracket builder to GitHub Pages → Run workflow**.
5. Once deployment succeeds, open `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.

The build copies only application assets to `dist`. Relative asset URLs support repository subpaths. GitHub Pages availability for private repositories depends on your GitHub plan; a public repository works with GitHub Free. A public site does not make your private Drive files public.

## 2. Set up Google sign-in

In https://console.cloud.google.com/:

1. Create or select a project.
2. Under **APIs & Services → Library**, enable **Google Drive API**.
3. Configure **Google Auth Platform** (also called the OAuth consent screen):
   - Set an app name such as `Arena Bracket Builder` and your email.
   - For a personal Gmail account, choose **External** audience.
   - While in Testing, add your Google email under **Test users**.
   - Add the scope `https://www.googleapis.com/auth/drive.file` under Data Access. The app only requests access to files it creates or that are explicitly shared with it, not your whole Drive.
4. Under **Clients / Credentials**, create an **OAuth client ID → Web application**.
5. Add **Authorized JavaScript origins**:
   - `https://YOUR-USERNAME.github.io` (origin only; do not include the repository path)
   - `http://localhost:3000` for local development
   - Add your custom-domain origin too if you use one.
6. Copy the client ID ending in `.apps.googleusercontent.com`.

No client secret, API key, service account key, or redirect URI is needed for this popup-based browser flow. The client ID is public configuration. Do not place a client secret in the repository.

## 3. Configure the app

Choose either:

- In the app, click **Google Drive**, paste the client ID, and click **Connect Google Drive**. The ID is saved in that browser.
- Or put the client ID in `config.js` as `googleClientId`, then redeploy. This avoids re-entering it on each device.

Sign in with your test-user Google account and grant access. Google creates the Arena folder on the first successful connection. Testing-mode grants may expire after seven days, and browser access tokens typically last about an hour; reconnect when asked. The app stores tokens only in memory, so reloading also requires reconnecting. Disconnect clears the in-memory session; to revoke the grant completely, remove the app from your Google account's third-party connections.

## 4. Save, load, and delete

- Build your bracket normally from Excel.
- Open **Google Drive**, select the local bracket, and click **Save to Drive**. This creates or updates its JSON file.
- Edits and scores save automatically **in the current browser only**. Click **Save to Drive** after changes; cloud saving is manual.
- On another device, connect using the same Google account and app client ID, then click **Load** beside the saved bracket. Load replaces that bracket's local copy after confirmation; other brackets remain.
- Before switching devices, save to Drive. Before editing on a different device, load the latest copy. The app checks Drive modification timestamps before overwriting or deleting a linked copy, but it is not a simultaneous multi-editor system.
- Delete from the Drive panel to move that file to Google Drive Trash and remove its local copy. Dashboard deletion also trashes the linked Drive file and requires a connected session. If a Drive operation fails, the local bracket remains.
- A bracket never saved or loaded on this browser has no Drive link; deleting that local bracket does not search for remote copies. Use the Drive panel to manage saved copies from other devices.
- If you manually trash a file outside the app, the old local link remains. Restore it in Drive before saving/deleting through the app again, or import the teams into a new bracket.
- Google Drive Trash counts toward storage until emptied. JSON bracket files are small. The available free quota is shared with Gmail and Google Photos.

You can continue exporting PNG/SVG/PDF for Instagram independently of Drive. Only bracket JSON is uploaded by this integration; images and source Excel files are not automatically uploaded.

## Troubleshooting

- **origin_mismatch:** Ensure the exact current origin is authorized. Ports matter. Changes can take a few minutes to propagate.
- **access_denied:** Add your Google account as a test user and verify Drive API is enabled.
- **Popup blocked / sign-in not loaded:** Allow popups and access to `accounts.google.com`, then retry.
- **Changed in Drive:** Export your local JSON backup, refresh and load the Drive copy, then make your changes. The app avoids silently overwriting newer data.
- **Wrong account:** Disconnect and reconnect to the account where that bracket was saved.
- **Site loads without styling:** Deploy the `dist` artifact with the included workflow, not the source folder.

Live sign-in needs your own client ID and authorized deployment origin. Automated tests mock Drive API responses; they do not authenticate to a real Google account.
