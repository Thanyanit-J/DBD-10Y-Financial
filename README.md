# DBD-10Y-Financial

Chrome Extension to show all 10 years of financial data at once in DBD DataWarehouse.

DBD DataWarehouse shows a Company's financial statements 5 Fiscal Years at a time. This extension changes the Financial Information tab so the table holds the Selected Fiscal Year and the years before it in one view.

## How it works

The extension runs one script in the page's main world. It hooks the site's own finance store: when the site loads the 5-year window ending at the Selected Fiscal Year, the extension loads the window before it through the same store action and gives the site's table the merged Year Records. The site's own token handling, decryption and table drawing do the rest. See `docs/adr/0001-reuse-dbd-page-store.md` and the glossary in `CONTEXT.md`.

## Build

```sh
npm install
npm run build      # writes the unpacked extension to dist/
npm test           # Vitest, against the fake DBD store in test/fake-dbd-store.ts
npm run typecheck
```

## Load in Chrome

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose the `dist/` folder.
3. Open a Company profile on https://datawarehouse.dbd.go.th and go to the Financial Information tab.

The extension asks for one host permission, `https://datawarehouse.dbd.go.th/*`, and collects no data.
