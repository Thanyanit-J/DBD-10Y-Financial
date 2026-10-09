import { expect, test } from "vitest";
import { installFinanceStoreHook } from "../src/finance-store-hook";
import {
  createFakeDbdStore,
  dbdFiscalYearOptions,
  fiscalYears,
  type FakeCompany,
  type FakeDbd,
} from "./fake-dbd-store";

const LEGAL_FORM = "7";
const REGISTRATION = "0107542000011";
const MODE = "balancesheet";

/** A Company with a long history: 14 Filed Years, Default Fiscal Year 2568 (CE 2025). */
const LONG_HISTORY: FakeCompany = {
  legalFormCode: LEGAL_FORM,
  registrationNumber: REGISTRATION,
  defaultFiscalYear: "2568",
  fiscalYearOptions: dbdFiscalYearOptions("2568"),
  filedYears: fiscalYears(2555, 2568),
};

test("selecting the Default Fiscal Year shows it and the 8 before it, requesting only DBD's Fiscal Year Options", async () => {
  const dbd = createFakeDbdStore(LONG_HISTORY);
  installFinanceStoreHook(dbd.store, dbd.readCompanyContext);

  await dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2568", MODE);

  expect(dbd.tableFiscalYears()).toEqual(fiscalYears(2560, 2568));
  expectOnlyOptionsRequested(dbd.requestedFiscalYears, LONG_HISTORY);
});

// Options 2021–2025 (BE 2564–2568), default 2025: 2017–2025 for 2025, then
// 2017–2024 … 2017–2021 for earlier selections — 9/8/7/6/5 columns (#8).
test.each([
  { selected: "2568", ce: "2025", columns: 9 },
  { selected: "2567", ce: "2024", columns: 8 },
  { selected: "2566", ce: "2023", columns: 7 },
  { selected: "2565", ce: "2022", columns: 6 },
  { selected: "2564", ce: "2021", columns: 5 },
])(
  "selecting $ce shows 2017–$ce: $columns columns, oldest boundary fixed, nothing after the selection",
  async ({ selected, columns }) => {
    const dbd = createFakeDbdStore(LONG_HISTORY);
    installFinanceStoreHook(dbd.store, dbd.readCompanyContext);

    await dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, selected, MODE);

    expect(dbd.tableFiscalYears()).toEqual(fiscalYears(2560, Number(selected)));
    expect(dbd.tableFiscalYears()).toHaveLength(columns);
    expectOnlyOptionsRequested(dbd.requestedFiscalYears, LONG_HISTORY);
  },
);

test("changing the selection on the same page keeps the oldest boundary and asks DBD for nothing outside its options", async () => {
  const dbd = createFakeDbdStore(LONG_HISTORY);
  installFinanceStoreHook(dbd.store, dbd.readCompanyContext);

  await dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2568", MODE);
  await dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2566", MODE);
  expect(dbd.tableFiscalYears()).toEqual(fiscalYears(2560, 2566));

  await dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2568", MODE);
  expect(dbd.tableFiscalYears()).toEqual(fiscalYears(2560, 2568));
  expectOnlyOptionsRequested(dbd.requestedFiscalYears, LONG_HISTORY);
});

// --- History shapes -------------------------------------------------------

function companyWithFiledYears(filedYears: string[], defaultFiscalYear = "2568"): FakeCompany {
  return {
    legalFormCode: LEGAL_FORM,
    registrationNumber: REGISTRATION,
    defaultFiscalYear,
    fiscalYearOptions: dbdFiscalYearOptions(defaultFiscalYear),
    filedYears,
  };
}

test("a Company with 3 Filed Years keeps DBD's native 5 columns, Empty Years included", async () => {
  const company = companyWithFiledYears(fiscalYears(2566, 2568));
  const dbd = createFakeDbdStore(company);
  installFinanceStoreHook(dbd.store, dbd.readCompanyContext);

  await dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2568", MODE);

  expect(dbd.tableFiscalYears()).toEqual(fiscalYears(2564, 2568));
  expect(dbd.tableEmptyYears()).toEqual(["2564", "2565"]);
  expectOnlyOptionsRequested(dbd.requestedFiscalYears, company);
});

test("a Company with 6 Filed Years shows 6 columns, not an empty oldest column to reach more", async () => {
  const company = companyWithFiledYears(fiscalYears(2563, 2568));
  const dbd = createFakeDbdStore(company);
  installFinanceStoreHook(dbd.store, dbd.readCompanyContext);

  await dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2568", MODE);

  expect(dbd.tableFiscalYears()).toEqual(fiscalYears(2563, 2568));
});

test("an Empty Year between Filed Years stays in the table", async () => {
  const company = companyWithFiledYears(["2561", "2562", "2564", "2565", "2566", "2567", "2568"]);
  const dbd = createFakeDbdStore(company);
  installFinanceStoreHook(dbd.store, dbd.readCompanyContext);

  await dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2568", MODE);

  expect(dbd.tableFiscalYears()).toEqual(fiscalYears(2561, 2568));
  expect(dbd.tableEmptyYears()).toEqual(["2563"]);
});

test("Filed Years older than the Default Fiscal Year minus 9 are never shown or requested", async () => {
  const company = companyWithFiledYears(fiscalYears(2540, 2568));
  const dbd = createFakeDbdStore(company);
  installFinanceStoreHook(dbd.store, dbd.readCompanyContext);

  await dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2568", MODE);

  expect(dbd.tableFiscalYears()).toEqual(fiscalYears(2560, 2568));
  expectOnlyOptionsRequested(dbd.requestedFiscalYears, company);
});

test("at most 10 columns: a Window that reaches past the Default Fiscal Year minus 9 is cut there", async () => {
  // Options reaching 2559 exist only in a fake: DBD's own dropdown stops at the default minus 4.
  const company: FakeCompany = {
    ...companyWithFiledYears(fiscalYears(2540, 2568)),
    fiscalYearOptions: ["2568", "2564", "2559"],
  };
  const dbd = createFakeDbdStore(company);
  installFinanceStoreHook(dbd.store, dbd.readCompanyContext);

  await dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2568", MODE);

  expect(dbd.tableFiscalYears()).toEqual(fiscalYears(2559, 2568));
  expect(dbd.tableFiscalYears()).toHaveLength(10);
  expect(dbd.requestedFiscalYears).toEqual(["2568", "2564", "2559"]);
});

// --- Fiscal Year Options other than DBD's usual 5 --------------------------

test("sparse options: only the offered Windows that join the covered years are requested", async () => {
  const company: FakeCompany = {
    ...companyWithFiledYears(fiscalYears(2555, 2568)),
    fiscalYearOptions: ["2568", "2565"],
  };
  const dbd = createFakeDbdStore(company);
  installFinanceStoreHook(dbd.store, dbd.readCompanyContext);

  await dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2568", MODE);

  expect(dbd.tableFiscalYears()).toEqual(fiscalYears(2561, 2568));
  expect(dbd.requestedFiscalYears).toEqual(["2568", "2565"]);
});

test("an option whose Window would leave a gap is not requested, and no unlisted year fills the gap", async () => {
  const company: FakeCompany = {
    ...companyWithFiledYears(fiscalYears(2555, 2568)),
    fiscalYearOptions: ["2568", "2561"],
  };
  const dbd = createFakeDbdStore(company);
  installFinanceStoreHook(dbd.store, dbd.readCompanyContext);

  await dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2568", MODE);

  expect(dbd.tableFiscalYears()).toEqual(fiscalYears(2564, 2568));
  expect(dbd.requestedFiscalYears).toEqual(["2568"]);
});

test("a selection that is not one of the Fiscal Year Options gets DBD's native view and no extra request", async () => {
  const dbd = createFakeDbdStore(LONG_HISTORY);
  installFinanceStoreHook(dbd.store, dbd.readCompanyContext);

  await dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2563", MODE);

  expect(dbd.tableFiscalYears()).toEqual(fiscalYears(2559, 2563));
  expect(dbd.requestedFiscalYears).toEqual(["2563"]);
});

// --- Missing or unusable context -------------------------------------------

test.each([
  { name: "no context", context: undefined },
  {
    name: "a Default Fiscal Year that is not a year",
    context: { ...LONG_HISTORY, defaultFiscalYear: "latest" },
  },
  {
    name: "options that are not years",
    context: { ...LONG_HISTORY, fiscalYearOptions: ["2568", "n/a", ""] },
  },
  {
    name: "no options at all",
    context: { ...LONG_HISTORY, fiscalYearOptions: [] },
  },
  {
    name: "a context for another Company",
    context: { ...LONG_HISTORY, registrationNumber: "0105567191218" },
  },
])("with $name the page keeps DBD's native view and the extension requests nothing", async ({ context }) => {
  const dbd = createFakeDbdStore(LONG_HISTORY);
  dbd.context = context;
  installFinanceStoreHook(dbd.store, dbd.readCompanyContext);

  await dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2568", MODE);

  expect(dbd.tableFiscalYears()).toEqual(fiscalYears(2564, 2568));
  expect(dbd.requestedFiscalYears).toEqual(["2568"]);
});

test("a context whose other options are all older than the Default Fiscal Year minus 9 gives DBD's native view", async () => {
  const company: FakeCompany = {
    ...companyWithFiledYears(fiscalYears(2540, 2568)),
    fiscalYearOptions: ["2568", "2550"],
  };
  const dbd = createFakeDbdStore(company);
  installFinanceStoreHook(dbd.store, dbd.readCompanyContext);

  await dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2568", MODE);

  expect(dbd.tableFiscalYears()).toEqual(fiscalYears(2564, 2568));
  expect(dbd.requestedFiscalYears).toEqual(["2568"]);
});

// --- Company identity and late results --------------------------------------

/** A young Company on the same page later: 2 Filed Years, Default Fiscal Year 2568. */
const YOUNG_COMPANY: FakeCompany = {
  legalFormCode: "5",
  registrationNumber: "0105567191218",
  defaultFiscalYear: "2568",
  fiscalYearOptions: dbdFiscalYearOptions("2568"),
  filedYears: ["2567", "2568"],
};

/** A Company whose Latest Fiscal Year is 2565: its options and period are anchored there. */
const DORMANT_COMPANY: FakeCompany = {
  legalFormCode: "5",
  registrationNumber: "0415556001690",
  defaultFiscalYear: "2565",
  fiscalYearOptions: dbdFiscalYearOptions("2565"),
  filedYears: fiscalYears(2550, 2565),
};

test("moving to another Company uses that Company's options and default, and shows only its records", async () => {
  const dbd = createFakeDbdStore(LONG_HISTORY);
  installFinanceStoreHook(dbd.store, dbd.readCompanyContext);
  await dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2568", MODE);

  dbd.showCompany(DORMANT_COMPANY);
  dbd.requestedFiscalYears.length = 0;
  await dbd.store.fetchFinCompanyByYear("5", "0415556001690", "2565", MODE);

  expect(dbd.tableFiscalYears()).toEqual(fiscalYears(2557, 2565));
  expect(dbd.tableRegistrationNumbers()).toEqual(["0415556001690"]);
  expectOnlyOptionsRequested(dbd.requestedFiscalYears, DORMANT_COMPANY);
});

test("moving to a young Company shows DBD's native 5 columns for it", async () => {
  const dbd = createFakeDbdStore(LONG_HISTORY);
  installFinanceStoreHook(dbd.store, dbd.readCompanyContext);
  await dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2568", MODE);

  dbd.showCompany(YOUNG_COMPANY);
  await dbd.store.fetchFinCompanyByYear("5", "0105567191218", "2568", MODE);

  expect(dbd.tableFiscalYears()).toEqual(fiscalYears(2564, 2568));
  expect(dbd.tableRegistrationNumbers()).toEqual(["0105567191218"]);
});

test("a late Window for an earlier selection cannot replace the current selection's table", async () => {
  // Options chosen so the two selections need different older Windows.
  const company: FakeCompany = {
    ...companyWithFiledYears(fiscalYears(2555, 2568)),
    fiscalYearOptions: ["2568", "2567", "2563", "2562"],
  };
  const dbd = createFakeDbdStore(company);
  installFinanceStoreHook(dbd.store, dbd.readCompanyContext);

  const releaseOlderWindow = dbd.holdWindow("2563");
  const firstSelection = dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2568", MODE);
  await untilDbdIsAsked("2563", dbd);
  await dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2567", MODE);
  expect(dbd.tableFiscalYears()).toEqual(fiscalYears(2559, 2567));

  releaseOlderWindow();
  await firstSelection;

  expect(dbd.tableFiscalYears()).toEqual(fiscalYears(2559, 2567));
  expectOnlyOptionsRequested(dbd.requestedFiscalYears, company);
});

test("a late Window for the previous Company cannot replace the current Company's table", async () => {
  const dbd = createFakeDbdStore(LONG_HISTORY);
  installFinanceStoreHook(dbd.store, dbd.readCompanyContext);

  const releaseOlderWindow = dbd.holdWindow("2564");
  const previousCompany = dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2568", MODE);
  await untilDbdIsAsked("2564", dbd);
  dbd.showCompany(DORMANT_COMPANY);
  await dbd.store.fetchFinCompanyByYear("5", "0415556001690", "2565", MODE);
  expect(dbd.tableFiscalYears()).toEqual(fiscalYears(2557, 2565));

  releaseOlderWindow();
  await previousCompany;

  expect(dbd.tableFiscalYears()).toEqual(fiscalYears(2557, 2565));
  expect(dbd.tableRegistrationNumbers()).toEqual(["0415556001690"]);
});

test("a late Window for the previous Company cannot take the table even when the new Company's own load fails", async () => {
  const dbd = createFakeDbdStore(LONG_HISTORY);
  installFinanceStoreHook(dbd.store, dbd.readCompanyContext);

  const releaseOlderWindow = dbd.holdWindow("2564");
  const previousCompany = dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2568", MODE);
  await untilDbdIsAsked("2564", dbd);
  const viewBeforeMoving = dbd.tableFiscalYears();

  dbd.showCompany(DORMANT_COMPANY);
  dbd.failWindow("2565");
  await dbd.store.fetchFinCompanyByYear("5", "0415556001690", "2565", MODE);
  releaseOlderWindow();
  await previousCompany;

  // DBD's failed load leaves its view as it was; the late Window must not change that.
  expect(dbd.tableFiscalYears()).toEqual(viewBeforeMoving);
  expect(dbd.tableFiscalYears()).not.toEqual(fiscalYears(2560, 2564));
});

test("a late Window for an earlier Statement Mode cannot replace the current Statement Mode's table", async () => {
  const dbd = createFakeDbdStore(LONG_HISTORY);
  installFinanceStoreHook(dbd.store, dbd.readCompanyContext);

  const releaseOlderWindow = dbd.holdWindow("2564", "balancesheet");
  const financialPosition = dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2568", "balancesheet");
  await untilDbdIsAsked("2564", dbd);
  await dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2568", "pl");
  expect(dbd.tableStatementMode()).toBe("pl");

  releaseOlderWindow();
  await financialPosition;

  expect(dbd.tableStatementMode()).toBe("pl");
  expect(dbd.tableFiscalYears()).toEqual(fiscalYears(2560, 2568));
});

// --- Failures -------------------------------------------------------------

test("when DBD's own load fails, the view stays as it was and the extension requests nothing", async () => {
  const dbd = createFakeDbdStore(LONG_HISTORY);
  installFinanceStoreHook(dbd.store, dbd.readCompanyContext);
  await dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2568", MODE);
  dbd.requestedFiscalYears.length = 0;

  dbd.failWindow("2566");
  await dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2566", MODE);

  expect(dbd.tableFiscalYears()).toEqual(fiscalYears(2560, 2568));
  expect(dbd.requestedFiscalYears).toEqual(["2566"]);
});

test("when an older Window fails, the table shows what loaded and no other request is made", async () => {
  const company: FakeCompany = {
    ...companyWithFiledYears(fiscalYears(2550, 2568)),
    fiscalYearOptions: ["2568", "2565", "2561"],
  };
  const dbd = createFakeDbdStore(company);
  installFinanceStoreHook(dbd.store, dbd.readCompanyContext);

  dbd.failWindow("2561");
  await dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2568", MODE);

  expect(dbd.tableFiscalYears()).toEqual(fiscalYears(2561, 2568));
  expect(dbd.requestedFiscalYears).toEqual(["2568", "2565", "2561"]);
});

test("when the only older Window fails, DBD's native view stays", async () => {
  const dbd = createFakeDbdStore(LONG_HISTORY);
  installFinanceStoreHook(dbd.store, dbd.readCompanyContext);

  dbd.failWindow("2564");
  await dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2568", MODE);

  expect(dbd.tableFiscalYears()).toEqual(fiscalYears(2564, 2568));
  expect(dbd.requestedFiscalYears).toEqual(["2568", "2564"]);
});

test("when reading the Company context throws, DBD's native view stays and nothing else is requested", async () => {
  const dbd = createFakeDbdStore(LONG_HISTORY);
  installFinanceStoreHook(dbd.store, () => {
    throw new Error("DBD changed its page");
  });

  await dbd.store.fetchFinCompanyByYear(LEGAL_FORM, REGISTRATION, "2568", MODE);

  expect(dbd.tableFiscalYears()).toEqual(fiscalYears(2564, 2568));
  expect(dbd.requestedFiscalYears).toEqual(["2568"]);
});

/** Waits until the extension has asked DBD for the Window ending at `fiscalYear`. */
async function untilDbdIsAsked(fiscalYear: string, dbd: FakeDbd): Promise<void> {
  while (!dbd.requestedFiscalYears.includes(fiscalYear)) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function expectOnlyOptionsRequested(requested: string[], company: FakeCompany): void {
  expect(requested.length).toBeGreaterThan(0);
  for (const fiscalYear of requested) {
    expect(company.fiscalYearOptions).toContain(fiscalYear);
  }
}
