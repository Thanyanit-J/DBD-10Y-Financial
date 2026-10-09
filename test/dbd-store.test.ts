import { expect, test } from "vitest";
import { readCompanyContext } from "../src/dbd-store";

// DBD's profile store holds the Company's Latest Fiscal Year; its sidebar
// offers that year and the 4 before it. Verified on the live site 2026-10-09.
const PROFILE = { jpNo: "0107542000011", jpTypeCode: "7", fiscalYear: "2568", jpName: "..." };

test("a Company's context comes from its profile: identity, Default Fiscal Year and DBD's 5 options", () => {
  expect(readCompanyContext({ profile: PROFILE })).toEqual({
    legalFormCode: "7",
    registrationNumber: "0107542000011",
    defaultFiscalYear: "2568",
    fiscalYearOptions: ["2568", "2567", "2566", "2565", "2564"],
  });
});

test("a Company whose latest filing is older is anchored to that year, not to the calendar", () => {
  const context = readCompanyContext({ profile: { ...PROFILE, jpNo: "0415556001690", jpTypeCode: "5", fiscalYear: "2565" } });
  expect(context?.defaultFiscalYear).toBe("2565");
  expect(context?.fiscalYearOptions).toEqual(["2565", "2564", "2563", "2562", "2561"]);
});

test.each([
  { name: "no profile store", store: undefined },
  { name: "a profile not loaded yet", store: { profile: null } },
  { name: "a profile with no Latest Fiscal Year", store: { profile: { ...PROFILE, fiscalYear: null } } },
  { name: "a Latest Fiscal Year that is not a year", store: { profile: { ...PROFILE, fiscalYear: "2568 2567" } } },
  { name: "a Registration Number of the wrong shape", store: { profile: { ...PROFILE, jpNo: 107542000011 } } },
  { name: "a Legal-Form Code of the wrong shape", store: { profile: { ...PROFILE, jpTypeCode: "" } } },
])("with $name there is no context, so the extension requests nothing", ({ store }) => {
  expect(readCompanyContext(store)).toBeUndefined();
});
