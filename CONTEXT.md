# DBD 10Y Financial

A Chrome extension for the DBD DataWarehouse website. It changes the Financial Information tab so that a Company's financial data for 10 fiscal years shows in one table, instead of 5 at a time.

## Language

### Company identity

**Company**:
A juristic person registered with DBD (Department of Business Development) that has a profile page on DBD DataWarehouse.
_Avoid_: Firm, entity, juristic person (in code and docs)

**Registration Number**:
The 13-digit identifier of a Company. It is a string and keeps its leading zeros.
_Avoid_: jpNo (outside API mapping code), tax ID, company ID

**Legal-Form Code**:
The one-digit DBD code for the legal form of a Company, for example 5 = private company, 7 = public company, 3 = limited partnership. It comes from the profile URL, never from the Registration Number.
_Avoid_: jpTypeCode (outside API mapping code), company type

**Profile Code**:
The Legal-Form Code followed by the Registration Number, as used in the profile URL (`/company/profile/50105537006617`).
_Avoid_: Company code

### Time

**Fiscal Year**:
A year of financial filing. DBD stores it in the Buddhist Era (BE = CE + 543). The site shows BE in Thai and CE in English.
_Avoid_: Year (when the era matters), FY

**Latest Fiscal Year**:
The most recent Fiscal Year for which the Company filed financial statements, as given by its profile.
_Avoid_: Current year

**Fiscal Year Options**:
The Fiscal Years the sidebar's Select Fiscal Year dropdown offers for a Company: the Default Fiscal Year and the 4 before it. The extension requests Windows only for these (ADR 0002).
_Avoid_: Dropdown years, selectable years, allowed years

**Default Fiscal Year**:
DBD's initial selection in the dropdown when a Company's Financial Information tab opens: its Latest Fiscal Year, read from the profile. It anchors the Displayed Years and does not change when the user selects another year.
_Avoid_: Initial year, anchor year

**Selected Fiscal Year**:
The Fiscal Year chosen in the sidebar's Select Fiscal Year dropdown. It is the newest Fiscal Year in the table.
_Avoid_: Chosen year, filter year

**Filed Year**:
A Fiscal Year for which the Company submitted financial statements, so its Year Record holds values.
_Avoid_: Data year, active year

**Empty Year**:
A Fiscal Year that DBD returns as a Year Record with no values, because the Company filed nothing for it.
_Avoid_: Placeholder year, null year

**Displayed Years**:
The Fiscal Years that the table shows: from the Company's first Filed Year, but no earlier than the Default Fiscal Year minus 9, up to the Selected Fiscal Year; at most 10, and never fewer than the 5 years that DBD shows by default.
_Avoid_: Year window, year range, 10 years

**Company Context**:
What DBD's page knows about the current Company before any financial data loads: its Legal-Form Code, Registration Number, Default Fiscal Year and Fiscal Year Options. Without it the extension makes no request.
_Avoid_: Profile (for this bundle), page state

### Financial Information

**Statement Mode**:
One of the three views of the Financial Information tab: Financial Position, Income Statement, Financial Ratios.
_Avoid_: Page, tab, report type

**Year Record**:
The financial data of one Company for one Fiscal Year, holding values for all three Statement Modes.
_Avoid_: Row, statement

**Window**:
The Year Records that one DBD request loads: the requested Fiscal Year and the 4 before it. DBD itself loads only the Window ending at the Selected Fiscal Year.
_Avoid_: Batch, page (DBD's request argument named `page` holds the Statement Mode, not a Window)

**Last-Year Value**:
A value inside a Year Record that repeats the same account for the previous Fiscal Year (the `…Ly` fields). Ratios have none.
_Avoid_: Prior value, Ly value

**Percent Change**:
The year-over-year change of an account, as supplied by DBD for each Year Record.
_Avoid_: Growth, delta

**Compare Mode**:
The sidebar choice between Yearly (one Company across Fiscal Years) and Industry (one Fiscal Year against other Companies in the same business type).
_Avoid_: Compare type
