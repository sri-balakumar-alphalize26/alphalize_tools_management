// Bottom-sheet branch picker. Shown on the Login screen right after auth
// when the user has 2+ allowed companies. User MUST pick one (no dismiss).
// Single-branch users never see this — Login auto-selects and proceeds.

import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  BackHandler,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { COLORS, FONT_FAMILY } from "@constants/theme";

const BranchPickerSheet = ({
  visible,
  branches = [],
  defaultBranchId = null,
  onPick,
  onClose,
}) => {
  const [selectedId, setSelectedId] = useState(defaultBranchId || branches?.[0]?.id || null);

  // Keep selection in sync when the prop changes (e.g. fresh login).
  useEffect(() => {
    if (visible) {
      setSelectedId(defaultBranchId || branches?.[0]?.id || null);
    }
  }, [visible, defaultBranchId, branches]);

  // Hardware back closes the picker (acts as cancel — same as the X
  // button) so the user lands back on the username/password form.
  useEffect(() => {
    if (!visible) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (onClose) onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  const handleContinue = () => {
    const picked = branches.find((b) => b.id === selectedId);
    if (picked && onPick) onPick(picked);
  };

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Pick a branch to continue</Text>
              <Text style={styles.subtitle}>Choose where you're working from today.</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="close" size={22} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {branches.map((b) => {
              const isActive = b.id === selectedId;
              return (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.row, isActive && styles.rowActive]}
                  activeOpacity={0.85}
                  onPress={() => setSelectedId(b.id)}
                >
                  <View style={[styles.radio, isActive && styles.radioActive]}>
                    {isActive ? (
                      <View style={styles.radioDot} />
                    ) : null}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.rowName, isActive && styles.rowNameActive]}>
                      {b.name}
                    </Text>
                    {b.phone ? (
                      <Text style={[styles.rowSub, isActive && styles.rowSubActive]}>
                        {b.phone}
                      </Text>
                    ) : null}
                  </View>
                  {isActive ? (
                    <MaterialIcons name="check-circle" size={20} color="#fff" />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[styles.continueBtn, !selectedId && styles.continueBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleContinue}
            disabled={!selectedId}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
            <MaterialIcons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingTop: 22,
    paddingHorizontal: 18,
    paddingBottom: 22,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F0F2",
    marginLeft: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: FONT_FAMILY.urbanistBold,
    color: COLORS.primaryThemeColor,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: FONT_FAMILY.urbanistMedium,
    color: "#888",
  },
  list: {
    maxHeight: 360,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  rowActive: {
    backgroundColor: COLORS.primaryThemeColor,
    borderColor: COLORS.primaryThemeColor,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.primaryThemeColor,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    borderColor: "#fff",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
  },
  rowName: {
    fontSize: 15,
    fontFamily: FONT_FAMILY.urbanistSemiBold,
    color: "#333",
  },
  rowNameActive: {
    color: "#fff",
  },
  rowSub: {
    fontSize: 12,
    fontFamily: FONT_FAMILY.urbanistMedium,
    color: "#999",
    marginTop: 2,
  },
  rowSubActive: {
    color: "#ffffffaa",
  },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.button,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 6,
  },
  continueBtnDisabled: {
    opacity: 0.5,
  },
  continueBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: FONT_FAMILY.urbanistBold,
    letterSpacing: 0.3,
  },
});

export default BranchPickerSheet;
