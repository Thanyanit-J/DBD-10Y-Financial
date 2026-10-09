import {
  type CompanyContext,
  type FinanceStore,
  type FinancialWindow,
  type ReadCompanyContext,
  type YearRecord,
  WINDOW_SIZE,
  isEmptyYear,
  isFiscalYear,
  windowCacheKey,
} from "./dbd-store";

/** The most Fiscal Years the table shows: the Default Fiscal Year and the 9 before it (ADR 0002). */
const MAX_DISPLAYED_YEARS = 10;

const hookedStores = new WeakSet<FinanceStore>();

/**
 * Replaces DBD's Window-loading action with one that also loads the older
 * Windows DBD's dropdown offers, through DBD's own action, and gives DBD's
 * table the Displayed Years. DBD's token handling, decryption and table
 * drawing do the rest (ADR 0001). The extension never asks for a Fiscal Year
 * that is not one of the Company's Fiscal Year Options (ADR 0002).
 *
 * `readCompanyContext` is asked on every load, so a page that moved to another
 * Company gets that Company's options. When it returns nothing usable, DBD's
 * view stays as it is and no extra request is made.
 *
 * Installing twice on the same store does nothing.
 */
export function installFinanceStoreHook(
  store: FinanceStore,
  readCompanyContext: ReadCompanyContext,
): void {
  if (hookedStores.has(store)) return;
  hookedStores.add(store);

  const dbdLoadWindow = store.fetchFinCompanyByYear;
  let latestLoad = 0;
  /**
   * The last view a load gave DBD's table. A newer load replaces it only once
   * it has something to show, so until then it is still what the page showed
   * before that load began.
   */
  let latestView: FinancialWindow | null = null;

  store.fetchFinCompanyByYear = async (
    legalFormCode,
    registrationNumber,
    selectedFiscalYear,
    statementMode,
  ) => {
    const thisLoad = ++latestLoad;

    /** True once a newer load started: this load must not touch the table any more. */
    const isObsolete = (): boolean => thisLoad !== latestLoad;
    /**
     * DBD's action points the table at every Window it finishes, so a late
     * Window of an obsolete load may have just replaced the latest view.
     */
    const restoreLatestView = (): void => {
      if (latestView) store.finCompareYear = latestView;
    };
    const show = (view: FinancialWindow): void => {
      latestView = view;
      store.finCompareYear = view;
    };

    /** Loads one Window through DBD's action; undefined when DBD's load failed. */
    const loadWindow = async (fiscalYear: string): Promise<FinancialWindow | undefined> => {
      await dbdLoadWindow.call(store, legalFormCode, registrationNumber, fiscalYear, statementMode);
      return store.finYearCache[
        windowCacheKey(legalFormCode, registrationNumber, fiscalYear, statementMode)
      ];
    };

    const newest = await loadWindow(selectedFiscalYear);
    if (isObsolete()) return restoreLatestView();
    if (!newest) return; // DBD's load failed and left its view as it was; so do we.
    latestView = newest; // DBD's action just pointed the table at it.

    // Read after DBD's own load, so a page that just moved to another Company
    // has that Company's profile in place.
    const plan = planDisplayedYears(readContext(), legalFormCode, registrationNumber, selectedFiscalYear);
    if (!plan) return;

    try {
      const windows = [newest.finStatementDailyDtos];
      for (const fiscalYear of plan.olderWindowFiscalYears) {
        const older = await loadWindow(fiscalYear);
        if (isObsolete()) return restoreLatestView();
        if (!older) break; // Show what loaded; a failed request never widens the scope.
        windows.push(older.finStatementDailyDtos);
      }

      const oldestWindowFirst = windows.reverse(); // on a duplicate, DBD's own Window for the selection wins
      const displayed = displayedYearRecords(
        mergeYearRecords(...oldestWindowFirst),
        plan.oldestFiscalYear,
        selectedFiscalYear,
      );
      // Each older load made DBD point its table at that Window, so the
      // table must be told what to draw either way: the Displayed Years, or
      // DBD's own 5 years when there are no more than that to show.
      show(displayed.length > WINDOW_SIZE ? { ...newest, finStatementDailyDtos: displayed } : newest);
    } catch {
      if (!isObsolete()) show(newest); // The page must never break because of us.
    }
  };

  function readContext(): CompanyContext | undefined {
    try {
      return readCompanyContext();
    } catch {
      return undefined;
    }
  }
}

interface DisplayPlan {
  /** The Fiscal Year Options whose Windows the extension loads, newest first. */
  olderWindowFiscalYears: string[];
  /** The oldest Fiscal Year the table may show: the Default Fiscal Year minus 9. */
  oldestFiscalYear: string;
}

/**
 * Decides which older Windows to load so that the table can show every Fiscal
 * Year from the Default Fiscal Year minus 9 up to the Selected Fiscal Year.
 * Each extra Window ends at a Fiscal Year Option and joins the years already
 * covered with no gap. Returns undefined when the context is missing, is for
 * another Company, or does not offer the Selected Fiscal Year: then the
 * extension loads nothing.
 */
function planDisplayedYears(
  context: CompanyContext | undefined,
  legalFormCode: string,
  registrationNumber: string,
  selectedFiscalYear: string,
): DisplayPlan | undefined {
  if (!context) return undefined;
  if (context.legalFormCode !== legalFormCode || context.registrationNumber !== registrationNumber) {
    return undefined;
  }
  if (!isFiscalYear(context.defaultFiscalYear) || !isFiscalYear(selectedFiscalYear)) return undefined;
  const selected = Number(selectedFiscalYear);
  const defaultYear = Number(context.defaultFiscalYear);
  const options = context.fiscalYearOptions.filter(isFiscalYear).map(Number);
  if (!options.includes(selected) || selected > defaultYear) return undefined;

  const oldest = defaultYear - (MAX_DISPLAYED_YEARS - 1);
  const olderWindowFiscalYears: string[] = [];
  let oldestCovered = selected - (WINDOW_SIZE - 1);
  while (oldestCovered > oldest) {
    const nextNeeded = oldestCovered - 1;
    // A Window ending at `option` covers option−4..option. To join the covered
    // years without a gap it must reach `nextNeeded`; the lowest such option
    // reaches furthest back.
    const candidates = options.filter(
      (option) => option >= nextNeeded && option - (WINDOW_SIZE - 1) <= nextNeeded,
    );
    if (candidates.length === 0) break;
    const option = Math.min(...candidates);
    olderWindowFiscalYears.push(String(option));
    oldestCovered = option - (WINDOW_SIZE - 1);
  }
  return { olderWindowFiscalYears, oldestFiscalYear: String(oldest) };
}

/**
 * The Year Records of the Displayed Years: from the oldest Fiscal Year the
 * table may show up to the Selected Fiscal Year, without the Empty Years
 * before the Company's first Filed Year. Empty Years between Filed Years stay.
 */
function displayedYearRecords(
  records: YearRecord[],
  oldestFiscalYear: string,
  selectedFiscalYear: string,
): YearRecord[] {
  const eligible = records.filter(
    (record) =>
      Number(record.fiscalYear) >= Number(oldestFiscalYear) &&
      Number(record.fiscalYear) <= Number(selectedFiscalYear),
  );
  const firstFiledYear = eligible.findIndex((record) => !isEmptyYear(record));
  return firstFiledYear === -1 ? [] : eligible.slice(firstFiledYear);
}

/** Oldest first, one Year Record per Fiscal Year. On a duplicate, the later Window wins. */
function mergeYearRecords(...windows: YearRecord[][]): YearRecord[] {
  const byFiscalYear = new Map<string, YearRecord>();
  for (const records of windows) {
    for (const record of records) {
      byFiscalYear.set(record.fiscalYear, record);
    }
  }
  return [...byFiscalYear.values()].sort((a, b) => Number(a.fiscalYear) - Number(b.fiscalYear));
}
