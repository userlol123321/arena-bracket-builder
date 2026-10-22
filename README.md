# Arena — Excel bracket builder

A bracket-building app with optional personal Google Drive storage. Upload a spreadsheet of team names, generate a bracket, and export it. Excel is processed in your browser; local mode requires no account.

## GitHub Pages and Google Drive

See **[SETUP.md](./SETUP.md)** for deployment and Google OAuth configuration. A GitHub Actions workflow builds and deploys the static site. Google Drive stores a separate JSON file for each bracket in a private `Arena Brackets` folder.

Use **Google Drive → Connect → Save to Drive** to upload a local bracket. Use **Load** on another device. Cloud saves are manual; edits continue to save locally automatically. Deleting a linked bracket also moves its Drive copy to Trash and requires sign-in.

```sh
npm run build
```

The deployable site is generated in `dist/`. Live Drive authentication requires your own Google OAuth client ID and an authorized site origin.

## Run

Requires Node.js 20 or newer.

```sh
npm install
npm start
```

Open **http://localhost:3000**. The server listens only on your own computer.

## Build a bracket from Excel

1. Click **Choose Excel file** or drop an `.xlsx` file onto the home screen. An Excel template is available there too.
2. Choose a worksheet and the column containing team names. Toggle the header checkbox as needed; a preview shows the detected teams.
3. Name your bracket and choose single elimination, double elimination, round robin, or Swiss.
4. Click **Build bracket**. Spreadsheet row order determines seeds; empty names are skipped. Between 2 and 128 uniquely named teams are supported.
5. Click **Export bracket** for PNG, SVG, or Print / Save as PDF. JSON exports preserve editable data; CSV exports contain standings.

To arrange seeds before generating, create a **Blank bracket**, upload Excel from **Teams & seeds**, and reorder or shuffle the teams. Import can replace or append teams. Generated brackets can be reset to edit teams; resetting clears scores.

Optional score entry advances winners. Double elimination includes a grand-final reset when necessary. Swiss generates one round at a time, pairing by points and avoiding rematches where possible (greedy pairing, not a federation-certified Swiss system). Single and double elimination automatically advance byes. Round-robin and Swiss draws are supported.

## Data and limits

- Data is saved in this browser's local storage. Use **Back up workspace** to keep a portable copy. Clearing browser data removes local brackets.
- Excel `.xlsx` only; save legacy `.xls` files as `.xlsx` in Excel first. Maximum file size: 5 MB. Worksheets are limited to 10,000 rows and 200 columns.
- Formula cells use their cached Excel result. Recalculate and save the workbook in Excel if those results are missing.
- Scores lock after submission. Resetting clears all results so you can rebuild the bracket.
- Wide image exports include every round. Long team names are shortened in images; the full names remain in the app and JSON.
- PDF export uses your browser's print dialog. Wide brackets may wrap over multiple pages.

## Verify

```sh
npm test
```

Tests exercise elimination brackets for every size from 2 to 128, double-elimination resets, round robin, Swiss byes, score validation, and Excel workbook parsing.

For browser-level checks with Google Chrome installed:

```sh
npm run test:browser
```

This checks Excel upload and sheet selection, bracket generation, PNG/SVG/JSON/CSV downloads, score entry, saved data, and mobile layout. Set `BROWSER_CHANNEL` to use another installed Playwright-supported browser channel.
