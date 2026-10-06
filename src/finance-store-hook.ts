import {
  type FinanceStore,
  type FinancialWindow,
  type YearRecord,
  WINDOW_SIZE,
  windowCacheKey,
} from "./dbd-store";

const hookedStores = new WeakSet<FinanceStore>();

/**
 * Replaces DBD's Window-loading action with one that also loads the Window
 * before it, through DBD's own action, and gives DBD's table the merged Year
 * Records. DBD's token handling, decryption and table drawing do the rest
 * (ADR 0001).
 *
 * Installing twice on the same store does nothing.
 */
export function installFinanceStoreHook(store: FinanceStore): void {
  if (hookedStores.has(store)) return;
  hookedStores.add(store);

  const dbdLoadWindow = store.fetchFinCompanyByYear;

  store.fetchFinCompanyByYear = async (
    legalFormCode,
    registrationNumber,
    selectedFiscalYear,
    statementMode,
  ) => {
    /** Loads one Window through DBD's action; undefined when DBD's load failed. */
    const loadWindow = async (fiscalYear: string): Promise<FinancialWindow | undefined> => {
      await dbdLoadWindow.call(store, legalFormCode, registrationNumber, fiscalYear, statementMode);
      return store.finYearCache[
        windowCacheKey(legalFormCode, registrationNumber, fiscalYear, statementMode)
      ];
    };

    const newest = await loadWindow(selectedFiscalYear);
    if (!newest) return; // Leave DBD's view as it is.

    const older = await loadWindow(String(Number(selectedFiscalYear) - WINDOW_SIZE));

    store.finCompareYear = older
      ? {
          ...newest,
          finStatementDailyDtos: mergeYearRecords(
            older.finStatementDailyDtos,
            newest.finStatementDailyDtos,
          ),
        }
      : newest;
  };
}

/** Oldest first, one Year Record per Fiscal Year. On a duplicate, the later Window wins. */
export function mergeYearRecords(...windows: YearRecord[][]): YearRecord[] {
  const byFiscalYear = new Map<string, YearRecord>();
  for (const records of windows) {
    for (const record of records) {
      byFiscalYear.set(record.fiscalYear, record);
    }
  }
  return [...byFiscalYear.values()].sort((a, b) => Number(a.fiscalYear) - Number(b.fiscalYear));
}
