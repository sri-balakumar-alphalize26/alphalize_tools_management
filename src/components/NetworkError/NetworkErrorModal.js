import React from "react";
import { BackHandler } from "react-native";
import useNetworkErrorStore from "../../stores/network/useNetworkErrorStore";
import StyledConfirmModal from "@components/Modal/StyledConfirmModal";

const NetworkErrorModal = () => {
  const { visible, title, message, onRetry, onCancel, hide } = useNetworkErrorStore();

  const handleRetry = () => {
    const cb = onRetry;
    hide();
    if (typeof cb === "function") cb();
  };

  const handleCancel = () => {
    const cb = onCancel;
    hide();
    if (typeof cb === "function") cb();
  };

  React.useEffect(() => {
    if (!visible) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleCancel();
      return true;
    });
    return () => sub.remove();
  }, [visible]);

  return (
    <StyledConfirmModal
      isVisible={visible}
      title={title || "Connection problem"}
      message={
        message ||
        "Cannot reach server. Please check your internet connection or router."
      }
      buttons={[
        { label: "Cancel", style: "cancel", onPress: handleCancel },
        { label: "Retry", style: "default", onPress: handleRetry },
      ]}
      onDismiss={handleCancel}
    />
  );
};

export default NetworkErrorModal;
