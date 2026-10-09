/**
 * Entry point of the content script. It runs in the page's main world
 * (manifest `world: "MAIN"`), because an isolated-world script cannot reach
 * the Vue app (ADR 0001).
 *
 * It waits for DBD's Nuxt app to create the finance store, then installs the
 * hook. If the store never appears, or its shape is not what we expect, it
 * does nothing and DBD's normal view stays as it is.
 */
import { type CompanyProfileStore, type FinanceStore, readCompanyContext } from "./dbd-store";
import { installFinanceStoreHook } from "./finance-store-hook";

const FINANCE_STORE_ID = "financeStore";
const COMPANY_PROFILE_STORE_ID = "companyProfileStore";
const POLL_INTERVAL_MS = 100;

/** The Nuxt root element carries the Vue app; Pinia keeps its stores in `_s`. */
interface NuxtRoot extends HTMLElement {
  __vue_app__?: {
    config?: {
      globalProperties?: {
        $pinia?: { _s?: Map<string, unknown> };
      };
    };
  };
}

function findStore(storeId: string): unknown {
  const root = document.getElementById("__nuxt") as NuxtRoot | null;
  return root?.__vue_app__?.config?.globalProperties?.$pinia?._s?.get(storeId);
}

function findFinanceStore(): FinanceStore | undefined {
  const store = findStore(FINANCE_STORE_ID);
  return isFinanceStore(store) ? store : undefined;
}

/**
 * Looked up on every load, not once: the profile store appears when the page
 * first shows a Company and keeps the current Company from then on.
 */
function findCompanyProfileStore(): CompanyProfileStore | undefined {
  const store = findStore(COMPANY_PROFILE_STORE_ID);
  return isCompanyProfileStore(store) ? store : undefined;
}

function isFinanceStore(candidate: unknown): candidate is FinanceStore {
  if (typeof candidate !== "object" || candidate === null) return false;
  const store = candidate as Partial<FinanceStore>;
  return (
    typeof store.fetchFinCompanyByYear === "function" &&
    typeof store.finYearCache === "object" &&
    store.finYearCache !== null
  );
}

function isCompanyProfileStore(candidate: unknown): candidate is CompanyProfileStore {
  return typeof candidate === "object" && candidate !== null && "profile" in candidate;
}

function hookFinanceStoreWhenReady(): void {
  try {
    const store = findFinanceStore();
    if (store) {
      installFinanceStoreHook(store, () => readCompanyContext(findCompanyProfileStore()));
      return;
    }
  } catch {
    // Fall through and keep waiting; the page must never break because of us.
  }
  setTimeout(hookFinanceStoreWhenReady, POLL_INTERVAL_MS);
}

hookFinanceStoreWhenReady();
