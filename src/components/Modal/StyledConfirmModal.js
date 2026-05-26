import React from "react";
import { View, Modal, StyleSheet, TouchableOpacity, TouchableWithoutFeedback } from "react-native";
import Text from "@components/Text";
import { COLORS, FONT_FAMILY } from "@constants/theme";

const StyledConfirmModal = ({
  isVisible,
  title,
  message,
  confirmLabel = "OK",
  cancelLabel,
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal
      visible={!!isVisible}
      transparent
      animationType="fade"
      onRequestClose={onCancel || onConfirm}
    >
      <TouchableWithoutFeedback onPress={onCancel || onConfirm}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              {title ? <Text style={styles.title}>{title}</Text> : null}
              {message ? <Text style={styles.message}>{message}</Text> : null}

              <View style={styles.actions}>
                {cancelLabel ? (
                  <TouchableOpacity
                    style={[styles.btn, styles.cancelBtn]}
                    onPress={onCancel}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cancelText}>{cancelLabel}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[styles.btn, styles.confirmBtn]}
                  onPress={onConfirm}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmText}>{confirmLabel}</Text>
                </TouchableOpacity>
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
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    minWidth: 90,
    alignItems: "center",
  },
  cancelBtn: {
    backgroundColor: "#f0f0f0",
  },
  confirmBtn: {
    backgroundColor: COLORS.button,
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
});

export default StyledConfirmModal;
