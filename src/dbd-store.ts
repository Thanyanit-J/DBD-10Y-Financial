/**
 * The parts of DBD DataWarehouse's Pinia `financeStore` that the extension
 * touches. Verified against the live site on 2026-10-06; see ADR 0001.
 *
 * This file is the API-mapping layer, so it may use DBD's own field names
 * (`jpTypeCode`, `jpNo`). Everything else in the extension uses the glossary
 * terms from CONTEXT.md.
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
