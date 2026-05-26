import { create } from "zustand";
import { setActiveCurrency } from "@utils/currency";

const FALLBACK = { symbol: "", name: "", position: "before" };

const useCurrencyStore = create((set) => ({
  currency: FALLBACK,
  setCurrencyConfig: (cfg) => {
    const next = cfg && typeof cfg === "object" ? { ...FALLBACK, ...cfg } : FALLBACK;
    setActiveCurrency(next);
    set({ currency: next });
  },
}));

export default useCurrencyStore;
