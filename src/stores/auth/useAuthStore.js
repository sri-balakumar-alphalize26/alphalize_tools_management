import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

const useAuthStore = create(
  persist(
    (set) => ({
      isLoggedIn: false,
      user: null,
      // Odoo auth object { uid, db, username, password }
      odooAuth: null,

      login: (userData, odooAuth) =>
        set({
          isLoggedIn: true,
          user: userData,
          odooAuth: odooAuth || null,
        }),

      logout: () =>
        set({
          isLoggedIn: false,
          user: null,
          odooAuth: null,
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
    }
  )
);

export default useAuthStore;
