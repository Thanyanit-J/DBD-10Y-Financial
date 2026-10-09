# DBD-10Y-Financial

Chrome Extension to show all 10 years of financial data at once in DBD DataWarehouse.

DBD DataWarehouse shows a Company's financial statements 5 Fiscal Years at a time. This extension changes the Financial Information tab so the table holds the Selected Fiscal Year and the years before it in one view.

## How it works

The extension runs one script in the page's main world. It hooks the site's own finance store: when the site loads the 5-year window ending at the Selected Fiscal Year, the extension loads the older windows that the site's own Select Fiscal Year dropdown offers, through the same store action, and gives the site's table the merged Year Records. The site's own token handling, decryption and table drawing do the rest.

The table is anchored to the Company's Default Fiscal Year (its latest filing): it shows at most ten years, from that year minus nine up to the selected year, and never asks DBD for a year outside the dropdown. A Company with a short history keeps DBD's normal five-year view. See `docs/adr/0001-reuse-dbd-page-store.md`, `docs/adr/0002-bound-history-to-dbd-fiscal-year-options.md` and the glossary in `CONTEXT.md`.

## Build

The project uses pnpm; the exact version is pinned in `package.json` (`packageManager`), so `corepack enable` once gives you the right one.

```sh
pnpm install
pnpm build         # writes the unpacked extension to dist/
pnpm test          # Vitest, against the fake DBD store in test/fake-dbd-store.ts
pnpm typecheck
```

## Load in Chrome

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose the `dist/` folder.
3. Open a Company profile on https://datawarehouse.dbd.go.th and go to the Financial Information tab.

The extension asks for one host permission, `https://datawarehouse.dbd.go.th/*`, and collects no data.
