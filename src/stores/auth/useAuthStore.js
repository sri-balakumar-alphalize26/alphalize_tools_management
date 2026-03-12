import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setOdooUrl } from "@api/config/odooConfig";

const useAuthStore = create(
  persist(
    (set) => ({
      isLoggedIn: false,
      user: null,
      // Odoo auth object { uid, db, username, password }
      odooAuth: null,
      // Persisted server URL so it survives app restarts
      serverUrl: null,

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

      setOdooAuth: (odooAuth) =>
        set({ odooAuth }),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        // Restore the server URL when the store is rehydrated from storage
        if (state?.serverUrl) {
          setOdooUrl(state.serverUrl);
        }
      },
    }
  )
);

export default useAuthStore;
