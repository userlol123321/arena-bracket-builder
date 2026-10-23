# Arena — Excel bracket builder

A personal, local-first bracket builder with Excel team import, image exports, and read-only live OBS links. No cloud accounts or API keys required.

## Run

Requires Node.js 20 or newer.

```sh
npm install
npm start
```

Open **http://localhost:3000** on your OBS computer.

## Features

- Import `.xlsx` team lists with worksheet/column selection and a preview; a template is included.
- Single elimination, double elimination, round robin, and Swiss formats.
- 2–128 teams, seed ordering/shuffling, automatic byes, scoring, and standings.
- Red-and-black default with seven color themes; per-bracket league name and uploaded logo, included in OBS, images, and backups.
- PNG/SVG bracket exports, browser Print / Save as PDF, CSV standings, and JSON backups.
- **OBS live link:** updates automatically when you edit scores; no editing controls in the viewer. Includes transparent background and auto-fit display.
- **Stop sharing** or delete the bracket to disable its local live link. Restarting the server also expires temporary links.
- **Back up workspace / Import backup** to transfer all brackets and scores to another computer.

## Using OBS

In a bracket, click **OBS live link → Create live link → Copy link**. Add an OBS **Browser Source**, paste the URL, and set it to **1920 × 1080**. Keep `npm start` running. Enter scores in the editor; the read-only viewer updates in about 1–2 seconds.

Live links work on the same computer as the server. The GitHub Pages version supports normal bracket work and backups; run locally for OBS. See **[SETUP.md](./SETUP.md)** for the full workflow.

## Make it yours

Use **Color theme** in the sidebar to choose the workspace theme and default for new brackets. Open any bracket and choose **Customize** to set its own palette, league name, and logo. Choices include red/black, purple, blue, emerald, orange, gold, and black/white. Upload PNG, JPEG, or WebP logos up to 3 MB; they are optimized locally and embedded in the bracket. **Apply appearance** updates an active OBS view automatically. Logos can be removed or replaced anytime, without resetting scores.

## Data and limits

- Brackets save automatically to this browser's local storage. Keep JSON backups before clearing browser data or changing computers.
- Live snapshots are temporary and held in local server memory. They are separate from saved bracket data.
- Excel `.xlsx` only; save legacy `.xls` workbooks as `.xlsx`. File limit: 5 MB, 10,000 rows and 200 columns per sheet. Team names must be unique.
- Spreadsheet row order determines initial seeding. Blank team names are skipped. Formula cells use cached Excel results.
- Live scores save while you type or use the − / + controls. Teams advance only when you explicitly click **Advance bracket**. Finalized scores lock; reset the bracket to clear results and edit teams again.
- Swiss uses greedy score-based pairing, avoiding rematches when possible; it is not a federation-certified pairing system.
- Large brackets scale to fit the OBS source and may need cropping/zooming for readable text. Long names are shortened in image views.

## Build and verify

```sh
npm test
npm run build
npm run test:browser
```

The GitHub Actions workflow publishes `dist/` to GitHub Pages. Tests cover bracket logic, Excel parsing, local link authorization/revocation, and browser flows including score updates in an independent viewer and backup transfer.
