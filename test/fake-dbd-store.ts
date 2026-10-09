import {
  type CompanyContext,
  type FinanceStore,
  type FinancialWindow,
  type StatementModeKey,
  type YearRecord,
  WINDOW_SIZE,
  isEmptyYear,
  windowCacheKey,
} from "../src/dbd-store";

/**
 * One Company as DBD's page knows it: its context (what the sidebar offers)
 * and the Fiscal Years for which it filed statements.
 */
export interface FakeCompany extends CompanyContext {
  /** Fiscal Years (BE) that have a filed statement. Every other year is an Empty Year. */
  filedYears: string[];
}

export interface FakeDbd {
  /** Stands in for DBD's `financeStore`. */
  store: FinanceStore;
  /**
   * What DBD's page says about the current Company. Tests replace it to
   * switch Company, or set it to undefined for a page with no usable context.
   */
  context: CompanyContext | undefined;
  readCompanyContext: () => CompanyContext | undefined;
  /** Every Fiscal Year the load action was asked for, in order: DBD's own request and the extension's. */
  requestedFiscalYears: string[];
  /** The Fiscal Years of the columns DBD's table draws, or undefined before any load. */
  tableFiscalYears: () => string[] | undefined;
  /** Of those, the Empty Years. */
  tableEmptyYears: () => string[] | undefined;
  /** The Registration Numbers of the Companies whose records the table draws; one, if all is well. */
  tableRegistrationNumbers: () => string[] | undefined;
  /** The Statement Mode of the Window the table draws. */
  tableStatementMode: () => StatementModeKey | undefined;
  /** Switches the page to another Company (DBD resets nothing in the finance store). */
  showCompany: (company: FakeCompany) => void;
  /**
   * Delays the Window for one Fiscal Year (in one Statement Mode, or in all)
   * until the returned function is called.
   */
  holdWindow: (fiscalYear: string, statementMode?: StatementModeKey) => () => void;
  /** Makes the request for one Fiscal Year fail, the way DBD's action fails: quietly. */
  failWindow: (fiscalYear: string) => void;
}

/**
 * Stands in for DBD's `financeStore` and the Company context its page offers.
 *
 * The load action behaves like DBD's `fetchFinCompanyByYear`: a Window
 * request for Fiscal Year X answers with the Year Records X−4..X, oldest
 * first, Empty Years included, writes them to `finYearCache` under DBD's key,
 * and points `finCompareYear` at the same object. A failed request sets the
 * store's `error`, writes nothing and never throws.
 *
 * Tests observe the table through `table…()` and the requests through
 * `requestedFiscalYears`. Those are the only seams.
 */
export function createFakeDbdStore(company: FakeCompany): FakeDbd {
  const companies = new Map<string, FakeCompany>();
  const holds = new Map<string, Promise<void>>();
  const failures = new Set<string>();
  const requestedFiscalYears: string[] = [];

  const store: FinanceStore & { error: unknown } = {
    finCompareYear: null,
    finYearCache: {},
    error: null,
    async fetchFinCompanyByYear(legalFormCode, registrationNumber, fiscalYear, statementMode) {
      requestedFiscalYears.push(fiscalYear);
      const key = windowCacheKey(legalFormCode, registrationNumber, fiscalYear, statementMode);
      const cached = store.finYearCache[key];
      if (cached) {
        store.finCompareYear = cached;
        return;
      }
      // The real action awaits the network.
      await (holds.get(holdKey(fiscalYear, statementMode)) ?? holds.get(holdKey(fiscalYear)) ?? Promise.resolve());
      if (failures.has(fiscalYear)) {
        store.error = new Error("Request failed");
        return;
      }
      const filedYears = companies.get(companyKey(legalFormCode, registrationNumber))?.filedYears ?? [];
      const loaded = windowEndingAt(fiscalYear, legalFormCode, registrationNumber, filedYears, statementMode);
      store.finYearCache[key] = loaded;
      store.finCompareYear = loaded;
    },
  };

  const tableRecords = (): YearRecord[] | undefined => store.finCompareYear?.finStatementDailyDtos;

  const fake: FakeDbd = {
    store,
    context: undefined,
    readCompanyContext: () => fake.context,
    requestedFiscalYears,
    tableFiscalYears: () => tableRecords()?.map((r) => r.fiscalYear),
    tableEmptyYears: () => tableRecords()?.filter(isEmptyYear).map((r) => r.fiscalYear),
    tableRegistrationNumbers: () => {
      const records = tableRecords();
      return records && [...new Set(records.map((r) => r.jpNo))];
    },
    tableStatementMode: () => store.finCompareYear?.["statementMode"] as StatementModeKey | undefined,
    showCompany: (next) => {
      companies.set(companyKey(next.legalFormCode, next.registrationNumber), next);
      fake.context = {
        legalFormCode: next.legalFormCode,
        registrationNumber: next.registrationNumber,
        defaultFiscalYear: next.defaultFiscalYear,
        fiscalYearOptions: [...next.fiscalYearOptions],
      };
    },
    holdWindow: (fiscalYear, statementMode) => {
      let release = (): void => {};
      holds.set(holdKey(fiscalYear, statementMode), new Promise<void>((resolve) => (release = resolve)));
      return release;
    },
    failWindow: (fiscalYear) => {
      failures.add(fiscalYear);
    },
  };
  fake.showCompany(company);
  return fake;
}

function companyKey(legalFormCode: string, registrationNumber: string): string {
  return `${legalFormCode}-${registrationNumber}`;
}

function holdKey(fiscalYear: string, statementMode?: StatementModeKey): string {
  return statementMode === undefined ? fiscalYear : `${fiscalYear}-${statementMode}`;
}

function windowEndingAt(
  fiscalYear: string,
  legalFormCode: string,
  registrationNumber: string,
  filedYears: string[],
  statementMode: StatementModeKey,
): FinancialWindow {
  const newest = Number(fiscalYear);
  const finStatementDailyDtos: YearRecord[] = [];
  for (let year = newest - (WINDOW_SIZE - 1); year <= newest; year++) {
    const fiscalYear = String(year);
    finStatementDailyDtos.push(
      filedYears.includes(fiscalYear)
        ? filedYearRecord(fiscalYear, legalFormCode, registrationNumber)
        : emptyYearRecord(fiscalYear, legalFormCode, registrationNumber),
    );
  }
  // DBD's Window carries more than the records (`fiscalYearSelected`, ...);
  // the fake tags it with the Statement Mode so a test can tell Windows apart.
  return { finStatementDailyDtos, statementMode };
}

/** A Filed Year as DBD returns it: `nullFlag` null, a row number, account values. */
function filedYearRecord(fiscalYear: string, legalFormCode: string, registrationNumber: string): YearRecord {
  return {
    fiscalYear,
    jpTypeCode: legalFormCode,
    jpNo: registrationNumber,
    rowNo: Number(fiscalYear),
    nullFlag: null,
    totalAssets: Number(fiscalYear) * 1000,
  };
}

/** An Empty Year as DBD returns it: `nullFlag` "Y", no row number, every account value null. */
function emptyYearRecord(fiscalYear: string, legalFormCode: string, registrationNumber: string): YearRecord {
  return {
    fiscalYear,
    jpTypeCode: legalFormCode,
    jpNo: registrationNumber,
    rowNo: null,
    nullFlag: "Y",
    totalAssets: null,
  };
}

/** Consecutive Fiscal Years (BE) from `first` to `last`, oldest first. */
export function fiscalYears(first: number, last: number): string[] {
  return Array.from({ length: last - first + 1 }, (_, i) => String(first + i));
}

/**
 * DBD's dropdown for a Default Fiscal Year, as seen on the live site: that
 * year and the 4 before it, newest first. Stated here on its own, apart from
 * the extension's reading of it, so the tests do not repeat the code.
 */
export function dbdFiscalYearOptions(defaultFiscalYear: string): string[] {
  return fiscalYears(Number(defaultFiscalYear) - 4, Number(defaultFiscalYear)).reverse();
}
