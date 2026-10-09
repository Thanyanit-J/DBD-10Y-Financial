# 2. Request only DBD's Fiscal Year Options, and anchor the table to the Default Fiscal Year

Date: 2026-10-09
Status: Accepted

## Context

DBD's API answers a Window request for any Fiscal Year, so the tracer bullet
(#1) asked for the Window ending 5 years before the Selected Fiscal Year and
showed 10 columns whatever the dropdown offered. Research found 19 populated
years for one Company. That is more history than the product means to show,
it asks DBD for Fiscal Years its own page never offers, and for a young
Company it drew 10 columns of which 8 were Empty Years.

The owner chose a product boundary: the extension may request only what
DBD's page itself offers, and shows at most ten years (#8).

What DBD's page offers, verified on the live site on 2026-10-09:

- **Default Fiscal Year**: `companyProfileStore.profile.fiscalYear`, the
  Company's Latest Fiscal Year. `ProfileTab22` seeds the sidebar's filter
  with it and renders the Financial Information tab only when it is set.
- **Fiscal Year Options**: `FinSidebar` builds the dropdown once, when it
  mounts, as the Default Fiscal Year and the 4 before it
  (`Array.from({ length: 5 }, (_, i) => String(default - i))`). It is the
  same 5 years for a Company with 2 Filed Years, for one with more than 10,
  and for one whose Latest Fiscal Year is 2565. It does not use the Filed
  Years (`profile.submitFinYear`) or the calendar year.
- **Empty Year**: a Window always holds all 5 Year Records; a year the
  Company filed nothing for comes back with `nullFlag: "Y"` and `rowNo: null`.

## Decision

1. Every extension-originated Window request ends at one of the current
   Company's Fiscal Year Options. The extension reads the Default Fiscal
   Year from DBD's profile store and derives the options the way DBD's
   sidebar does; that derivation lives in the API-mapping layer
   (`src/dbd-store.ts`) and is re-verified when DBD changes.
2. The table is anchored to the Default Fiscal Year: it may show the years
   from the Default Fiscal Year minus 9 up to the Selected Fiscal Year, at
   most ten, sorted, unique. Selecting an earlier year trims the newest end
   only; the oldest boundary never moves back.
3. Older Windows are added only where they join the covered years with no
   gap. Years that no offered Window reaches are left out; no unlisted
   request fills a gap.
4. Empty Years before the Company's first Filed Year are not shown. Empty
   Years between Filed Years stay. When that leaves no more than DBD's own
   5 years, DBD's native Window is shown as it is, Empty Years included.
5. When the Company context is missing, malformed, for another Company, or
   does not offer the Selected Fiscal Year, the extension makes no request
   and leaves DBD's view alone. A failed older request stops the extension's
   loading; it never widens the request scope.
6. A late Window from an obsolete load (an earlier selection, Statement Mode
   or Company) cannot replace the current view: DBD's action points its table
   at every Window it finishes, so the hook puts the latest load's view back.

## Alternatives considered

- **Read the options from the sidebar's `<select>`.** It is what the user
  sees, but it does not exist yet when DBD's first load fires (the parent's
  immediate watcher runs before the sidebar mounts) and it is re-rendered on
  language changes. The profile store is available first and is the source
  the sidebar itself reads.
- **Use `profile.submitFinYear` (the Filed Years).** The profile tab lists
  them as clickable years, but the dropdown does not use them: a Company with
  2 Filed Years still gets 5 options. Requests would then differ from what
  the dropdown offers.
- **Probe backwards until a Window comes back empty.** Rejected by the
  owner: that is the unlimited-history behaviour this decision replaces.

## Consequences

- With DBD's 5-option dropdown, actual Year Records cover at most 9 years
  (Default Fiscal Year minus 8 up to the Default). The tenth column can only
  come from the Last-Year Values of the oldest Year Record (#9).
- The hook depends on `companyProfileStore.profile` (`jpNo`, `jpTypeCode`,
  `fiscalYear`) in addition to ADR 0001's finance-store names. If DBD changes
  how the sidebar derives its options, `src/dbd-store.ts` must follow.
- The test harness (`test/fake-dbd-store.ts`) carries the Company context,
  pads Empty Years like DBD, and records every requested Fiscal Year, so a
  visually correct table cannot hide a request outside the options.
