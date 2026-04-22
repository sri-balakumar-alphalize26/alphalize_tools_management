import { create } from "zustand";

const useNetworkErrorStore = create((set) => ({
  visible: false,
  title: "",
  message: "",
  onRetry: null,
  onCancel: null,
  show: ({ title, message, onRetry, onCancel }) =>
    set({ visible: true, title, message, onRetry, onCancel }),
  hide: () =>
    set({ visible: false, title: "", message: "", onRetry: null, onCancel: null }),
}));

export default useNetworkErrorStore;
