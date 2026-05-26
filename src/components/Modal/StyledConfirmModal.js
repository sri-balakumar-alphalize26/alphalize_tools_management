import React from "react";
import { View, Modal, StyleSheet, TouchableOpacity, TouchableWithoutFeedback } from "react-native";
import Text from "@components/Text";
import { COLORS, FONT_FAMILY } from "@constants/theme";

// Two supported APIs:
// (1) Legacy:  { isVisible, title, message, confirmLabel, cancelLabel, onConfirm, onCancel }
// (2) Buttons array: { isVisible, title, message, buttons: [{label, onPress, style}], onDismiss }
//     style ∈ "default" | "cancel" | "destructive"
const StyledConfirmModal = ({
  isVisible,
  title,
  message,
  confirmLabel = "OK",
  cancelLabel,
  onConfirm,
  onCancel,
  buttons,
  onDismiss,
}) => {
  // Normalize to a buttons array regardless of which API was used.
  let normalized = buttons;
  if (!Array.isArray(normalized) || normalized.length === 0) {
    normalized = [];
    if (cancelLabel) normalized.push({ label: cancelLabel, onPress: onCancel, style: "cancel" });
    normalized.push({ label: confirmLabel, onPress: onConfirm, style: "default" });
  }

  const backdropPress = () => {
    if (onDismiss) onDismiss();
    else if (onCancel) onCancel();
    else if (onConfirm) onConfirm();
  };

  // Stack buttons vertically when there are 3 or more — keeps the modal
  // readable and matches typical action-sheet expectations.
  const stack = normalized.length >= 3;

  return (
    <Modal
      visible={!!isVisible}
      transparent
      animationType="fade"
      onRequestClose={backdropPress}
    >
      <TouchableWithoutFeedback onPress={backdropPress}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              {title ? <Text style={styles.title}>{title}</Text> : null}
              {message ? <Text style={styles.message}>{message}</Text> : null}

              <View style={[styles.actions, stack && styles.actionsStacked]}>
                {normalized.map((btn, i) => {
                  const style = btn.style || "default";
                  const btnStyle = [
                    styles.btn,
                    stack && styles.btnStacked,
                    style === "cancel" && styles.cancelBtn,
                    style === "destructive" && styles.destructiveBtn,
                    style === "default" && styles.confirmBtn,
                  ];
                  const textStyle = [
                    style === "cancel" && styles.cancelText,
                    style === "destructive" && styles.destructiveText,
                    style === "default" && styles.confirmText,
                  ];
                  return (
                    <TouchableOpacity
                      key={i}
                      style={btnStyle}
                      onPress={() => { if (btn.onPress) btn.onPress(); }}
                      activeOpacity={0.8}
                    >
                      <Text style={textStyle}>{btn.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  title: {
    fontSize: 17,
    fontFamily: FONT_FAMILY.urbanistBold,
    color: COLORS.primaryThemeColor,
    marginBottom: 10,
  },
  message: {
    fontSize: 14,
    fontFamily: FONT_FAMILY.urbanistMedium,
    color: "#444",
    lineHeight: 20,
    marginBottom: 18,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  actionsStacked: {
    flexDirection: "column",
    gap: 8,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    minWidth: 90,
    alignItems: "center",
  },
  btnStacked: {
    width: "100%",
    paddingVertical: 12,
  },
  cancelBtn: {
    backgroundColor: "#f0f0f0",
  },
  confirmBtn: {
    backgroundColor: COLORS.button,
  },
  destructiveBtn: {
    backgroundColor: "#E53935",
  },
  cancelText: {
    fontSize: 14,
    fontFamily: FONT_FAMILY.urbanistBold,
    color: "#555",
  },
  confirmText: {
    fontSize: 14,
    fontFamily: FONT_FAMILY.urbanistBold,
    color: "#fff",
  },
  destructiveText: {
    fontSize: 14,
    fontFamily: FONT_FAMILY.urbanistBold,
    color: "#fff",
  },
});

export default StyledConfirmModal;
