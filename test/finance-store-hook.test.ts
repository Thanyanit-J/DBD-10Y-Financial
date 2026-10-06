import { expect, test } from "vitest";
import { installFinanceStoreHook } from "../src/finance-store-hook";
import { createFakeDbdStore, yearRecord } from "./fake-dbd-store";

const FILED_YEARS = [
  "2555", "2556", "2557", "2558", "2559", "2560", "2561",
  "2562", "2563", "2564", "2565", "2566", "2567", "2568",
];

test("loading the Window for the Selected Fiscal Year gives DBD's table that year and the 9 before it, oldest first", async () => {
  const store = createFakeDbdStore(FILED_YEARS.map((fiscalYear) => yearRecord(fiscalYear)));
  installFinanceStoreHook(store);

  await store.fetchFinCompanyByYear("7", "0107542000011", "2568", "balancesheet");

  const fiscalYears = store.finCompareYear?.finStatementDailyDtos.map((r) => r.fiscalYear);
  expect(fiscalYears).toEqual([
    "2559", "2560", "2561", "2562", "2563",
    "2564", "2565", "2566", "2567", "2568",
  ]);
});
