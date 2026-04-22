import axios from "axios";
import NetInfo from "@react-native-community/netinfo";
import useNetworkErrorStore from "../../stores/network/useNetworkErrorStore";

const isNetworkError = (error) => {
  if (!error) return false;
  if (!error.response) return true;
  if (error.code === "ECONNABORTED") return true;
  if (typeof error.message === "string" && /Network Error/i.test(error.message)) return true;
  return false;
};

const pickMessage = () => ({
  title: "No internet connection",
  message: "You appear to be offline. Please check your Wi-Fi or mobile data and try again.",
});

let installed = false;

export function installNetworkInterceptor() {
  if (installed) return;
  installed = true;

  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (!isNetworkError(error)) return Promise.reject(error);

      const config = error.config;
      if (!config || config.__networkRetried) return Promise.reject(error);

      let offline = false;
      try {
        const state = await NetInfo.fetch();
        offline = state.isConnected === false || state.isInternetReachable === false;
      } catch (_) {
        offline = false;
      }

      if (!offline) return Promise.reject(error);

      return new Promise((resolve, reject) => {
        const { show } = useNetworkErrorStore.getState();
        const { title, message } = pickMessage();
        show({
          title,
          message,
          onRetry: async () => {
            try {
              const retryConfig = { ...config, __networkRetried: true };
              const res = await axios.request(retryConfig);
              resolve(res);
            } catch (e) {
              reject(e);
            }
          },
          onCancel: () => reject(error),
        });
      });
    }
  );
}

export default installNetworkInterceptor;
