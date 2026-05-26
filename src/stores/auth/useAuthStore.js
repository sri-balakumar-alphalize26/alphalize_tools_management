import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setOdooUrl } from "@api/config/odooConfig";
import { setActiveCurrency, setActiveDigits } from "@utils/currency";

const FALLBACK_CURRENCY = { symbol: "", name: "", position: "before" };

const useAuthStore = create(
  persist(
    (set) => ({
      isLoggedIn: false,
      user: null,
      odooAuth: null,
      serverUrl: null,
      currency: FALLBACK_CURRENCY,
      decimalAccuracy: {},

      login: (userData, odooAuth, serverUrl) =>
        set({
          isLoggedIn: true,
          user: userData,
          odooAuth: odooAuth || null,
          serverUrl: serverUrl || null,
        }),

      logout: () =>
        set({
          isLoggedIn: false,
          user: null,
          odooAuth: null,
          serverUrl: null,
        }),

      updateUser: (userData) =>
        set((state) => ({
          user: { ...state.user, ...userData },
        })),

      setOdooAuth: (odooAuth) => set({ odooAuth }),

      setCurrency: (cfg) => {
        const next = cfg && typeof cfg === "object" ? { ...FALLBACK_CURRENCY, ...cfg } : FALLBACK_CURRENCY;
        setActiveCurrency(next);
        set({ currency: next });
      },

      setDecimalAccuracy: (map) => {
        const next = map && typeof map === "object" ? { ...map } : {};
        setActiveDigits(next);
        set({ decimalAccuracy: next });
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state?.serverUrl) setOdooUrl(state.serverUrl);
        // Push persisted currency/digits into the module-level caches so
        // the first paint after a cold start already renders the right
        // symbol — no flash of empty / wrong currency.
        if (state?.currency) setActiveCurrency(state.currency);
        if (state?.decimalAccuracy) setActiveDigits(state.decimalAccuracy);
      },
    }
  )
);

export default useAuthStore;
