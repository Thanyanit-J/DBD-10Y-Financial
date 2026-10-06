import {
  type FinanceStore,
  type FinancialWindow,
  type YearRecord,
  WINDOW_SIZE,
  windowCacheKey,
} from "../src/dbd-store";

/**
 * Stands in for DBD's `financeStore`.
 *
 * Its load action behaves like DBD's `fetchFinCompanyByYear`: a Window request
 * for Fiscal Year X answers with the prepared Year Records X−4..X, oldest
 * first, writes them to `finYearCache` under DBD's key, and points
 * `finCompareYear` at the same object.
 *
 * Tests read `finCompareYear.finStatementDailyDtos`: that is what DBD's table
 * draws, and it is the only seam the tests check.
 */
export function createFakeDbdStore(filedYearRecords: YearRecord[]): FinanceStore {
  const store: FinanceStore = {
    finCompareYear: null,
    finYearCache: {},
    async fetchFinCompanyByYear(legalFormCode, registrationNumber, fiscalYear, statementMode) {
      const key = windowCacheKey(legalFormCode, registrationNumber, fiscalYear, statementMode);
      const cached = store.finYearCache[key];
      if (cached) {
        store.finCompareYear = cached;
        return;
      }
      await Promise.resolve(); // the real action awaits the network
      const loaded = windowEndingAt(fiscalYear, filedYearRecords);
      store.finYearCache[key] = loaded;
      store.finCompareYear = loaded;
    },
  };
  return store;
}

function windowEndingAt(fiscalYear: string, filedYearRecords: YearRecord[]): FinancialWindow {
  const newest = Number(fiscalYear);
  const oldest = newest - (WINDOW_SIZE - 1);
  const finStatementDailyDtos = filedYearRecords
    .filter((record) => {
      const recordFiscalYear = Number(record.fiscalYear);
      return recordFiscalYear >= oldest && recordFiscalYear <= newest;
    })
    .sort((a, b) => Number(a.fiscalYear) - Number(b.fiscalYear));
  return { finStatementDailyDtos };
}

/** A Year Record with a few account fields, in the shape DBD returns. */
export function yearRecord(fiscalYear: string, fields: Record<string, unknown> = {}): YearRecord {
  return {
    fiscalYear,
    jpTypeCode: "7",
    jpNo: "0107542000011",
    rowNo: Number(fiscalYear),
    ...fields,
  };
}
