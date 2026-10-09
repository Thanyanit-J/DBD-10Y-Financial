/**
 * The parts of DBD DataWarehouse's Pinia stores that the extension touches.
 * Verified against the live site on 2026-10-06 and 2026-10-09; see ADR 0001
 * and ADR 0002.
 *
 * This file is the API-mapping layer, so it may use DBD's own field names
 * (`jpTypeCode`, `jpNo`, `nullFlag`). Everything else in the extension uses
 * the glossary terms from CONTEXT.md.
 */

/** A Company's financial data for one Fiscal Year: one `finStatementDailyDtos` item. */
export interface YearRecord {
  /** Fiscal Year in the Buddhist Era, as a string, e.g. "2568". */
  fiscalYear: string;
  /** Legal-Form Code, e.g. "7". */
  jpTypeCode: string;
  /** Registration Number, 13 digits with leading zeros. */
  jpNo: string;
  /** The ~140 account fields (`assets`, `assetsLy`, `assetsPc`, ...). */
  [field: string]: unknown;
}

/**
 * The entry DBD stores for one Window request. DBD's table draws one column
 * per item of `finStatementDailyDtos`, sorted by Fiscal Year.
 */
export interface FinancialWindow {
  finStatementDailyDtos: YearRecord[];
  [field: string]: unknown;
}

/** Fiscal Years in one Window: the requested Fiscal Year and the 4 before it. */
export const WINDOW_SIZE = 5;

/** DBD's name for the Statement Mode in a Window request, e.g. "balancesheet". */
export type StatementModeKey = string;

/**
 * DBD's `fetchFinCompanyByYear` action. A request for Fiscal Year X loads the
 * Year Records X−4..X. On success it writes the window to `finYearCache` under
 * `windowCacheKey(...)` and points `finCompareYear` at the same object. It
 * never throws: failures go to the store's `error` and the cache stays empty.
 */
export type LoadFinancialWindow = (
  legalFormCode: string,
  registrationNumber: string,
  fiscalYear: string,
  statementMode: StatementModeKey,
) => Promise<void>;

export interface FinanceStore {
  finCompareYear: FinancialWindow | null;
  finYearCache: Record<string, FinancialWindow>;
  fetchFinCompanyByYear: LoadFinancialWindow;
}

/** The key DBD uses in `finYearCache`: `<jpType>-<jpNo>-<fiscalYear>-<page>`. */
export function windowCacheKey(
  legalFormCode: string,
  registrationNumber: string,
  fiscalYear: string,
  statementMode: StatementModeKey,
): string {
  return `${legalFormCode}-${registrationNumber}-${fiscalYear}-${statementMode}`;
}

/**
 * An Empty Year is a Year Record that DBD pads a Window with when the Company
 * filed nothing for that Fiscal Year. DBD marks it with `nullFlag: "Y"`
 * (Filed Years carry `nullFlag: null`). Every Window holds all 5 Fiscal Years,
 * Empty Years included.
 */
export function isEmptyYear(record: YearRecord): boolean {
  return record["nullFlag"] === "Y";
}

/**
 * What DBD's page knows about the current Company before it loads any
 * financial data. The extension only ever requests Fiscal Years that are in
 * `fiscalYearOptions` (ADR 0002).
 */
export interface CompanyContext {
  legalFormCode: string;
  registrationNumber: string;
  /** DBD's initial selection in the Select Fiscal Year dropdown, in BE. */
  defaultFiscalYear: string;
  /** Every Fiscal Year the dropdown offers, in BE, in DBD's order (newest first). */
  fiscalYearOptions: string[];
}

/** Reads the current Company's context, or undefined when it is not available. */
export type ReadCompanyContext = () => CompanyContext | undefined;

/**
 * The parts of DBD's Pinia `companyProfileStore` that the extension reads.
 * `profile` is the Company whose page is open; it is null until loaded.
 */
export interface CompanyProfileStore {
  profile: {
    jpNo?: unknown;
    jpTypeCode?: unknown;
    /** The Latest Fiscal Year, in BE. DBD seeds the Select Fiscal Year dropdown with it. */
    fiscalYear?: unknown;
    [field: string]: unknown;
  } | null;
}

/**
 * How many Fiscal Years DBD's sidebar (`FinSidebar`) offers: it builds the
 * dropdown as `Array.from({ length: 5 }, (_, i) => String(default - i))`
 * from the profile's `fiscalYear`, once, when it mounts. Verified 2026-10-09
 * on a Company with 2 Filed Years, on one with more than 10, and on one whose
 * Latest Fiscal Year is 2565: the dropdown is always these 5 years, never the
 * Filed Years (`profile.submitFinYear`) and never the calendar year.
 */
const FISCAL_YEAR_OPTION_COUNT = 5;

const REGISTRATION_NUMBER = /^\d{13}$/;
const LEGAL_FORM_CODE = /^\d$/;

/** A Fiscal Year as DBD's store holds it: a 4-digit BE string such as "2568". */
export function isFiscalYear(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}$/.test(value);
}

/**
 * Builds the Company context from DBD's profile store, the same way DBD's own
 * page does. Returns undefined when the profile is missing or malformed, so
 * the extension makes no request of its own.
 */
export function readCompanyContext(profileStore: CompanyProfileStore | undefined): CompanyContext | undefined {
  const profile = profileStore?.profile;
  if (!profile) return undefined;
  const { jpNo, jpTypeCode, fiscalYear } = profile;
  if (typeof jpNo !== "string" || !REGISTRATION_NUMBER.test(jpNo)) return undefined;
  if (typeof jpTypeCode !== "string" || !LEGAL_FORM_CODE.test(jpTypeCode)) return undefined;
  if (!isFiscalYear(fiscalYear)) return undefined;

  const defaultYear = Number(fiscalYear);
  return {
    legalFormCode: jpTypeCode,
    registrationNumber: jpNo,
    defaultFiscalYear: fiscalYear,
    fiscalYearOptions: Array.from({ length: FISCAL_YEAR_OPTION_COUNT }, (_, i) =>
      String(defaultYear - i),
    ),
  };
}
