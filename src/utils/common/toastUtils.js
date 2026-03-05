import Toast from "react-native-toast-message";

export const showToastMessage = (message, type = "info") => {
  Toast.show({
    type,
    text1: message,
    position: "bottom",
    visibilityTime: 3000,
  });
};

export const showSuccessToast = (message) => {
  showToastMessage(message, "success");
};

export const showErrorToast = (message) => {
  showToastMessage(message, "error");
};
