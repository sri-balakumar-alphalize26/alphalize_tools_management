import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "@components/containers";
import { COLORS, FONT_FAMILY } from "@constants/theme";
import { useAuthStore } from "@stores/auth";
import useToolStore from "@stores/toolManagement/useToolStore";
import { switchCompany } from "@api/services/odooService";
import { showToastMessage } from "@components/Toast";
import Constants from "expo-constants";

const ProfileScreen = () => {
  const user = useAuthStore((state) => state.user);
  const odooAuth = useAuthStore((state) => state.odooAuth);
  const updateUser = useAuthStore((state) => state.updateUser);
  const clearData = useToolStore((state) => state.clearData);
  const fetchAllData = useToolStore((state) => state.fetchAllData);
  const initial = (user?.username || "U").charAt(0).toUpperCase();
  const [switching, setSwitching] = useState(false);

  const details = [
    { icon: "fingerprint", label: "User ID", value: user?.uid ?? "-", color: "#2196F3" },
    { icon: "storage", label: "Database", value: user?.database ?? "-", color: "#FF9800" },
    { icon: "admin-panel-settings", label: "Role", value: user?.is_admin ? "Admin" : "User", color: "#9C27B0" },
    { icon: "business", label: "Current Branch", value: user?.company_name || "-", color: "#00897B" },
  ];

  const companies = user?.allowed_companies || [];

  const handleSwitchCompany = async (company) => {
    if (company.id === user?.company_id) return;
    Alert.alert(
      "Switch Branch",
      `Switch to "${company.name}"? The app will reload data for this branch.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Switch",
          onPress: async () => {
            setSwitching(true);
            try {
              await switchCompany(odooAuth, company.id);
              updateUser({ company_id: company.id, company_name: company.name });
              clearData();
              await fetchAllData(odooAuth, true);
              showToastMessage(`Switched to ${company.name}`);
            } catch (e) {
              showToastMessage("Failed to switch branch");
            } finally {
              setSwitching(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView backgroundColor={COLORS.primaryThemeColor}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Banner */}
        <View style={styles.header}>
          <Image
            source={require("@assets/images/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Profile Card */}
        <View style={styles.card}>
          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          </View>

          <Text style={styles.username}>{user?.username || "User"}</Text>
          <View style={styles.connectedBadge}>
            <MaterialIcons name="verified" size={13} color="#4CAF50" />
            <Text style={styles.connectedText}>Connected</Text>
          </View>

          <View style={styles.dividerLine} />

          {/* Account Details */}
          {details.map((item, index) => (
            <View key={index}>
              <View style={styles.row}>
                <View style={[styles.iconBox, { backgroundColor: item.color + "18" }]}>
                  <MaterialIcons name={item.icon} size={20} color={item.color} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.label}>{item.label}</Text>
                  <Text style={styles.value}>{String(item.value)}</Text>
                </View>
              </View>
              {index < details.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* Branches Card */}
        {companies.length > 0 && (
          <View style={styles.branchCard}>
            <View style={styles.branchHeader}>
              <MaterialIcons name="account-tree" size={20} color={COLORS.primaryThemeColor} />
              <Text style={styles.branchTitle}>Branches</Text>
            </View>
            {companies.map((company) => {
              const isActive = company.id === user?.company_id;
              return (
                <TouchableOpacity
                  key={company.id}
                  style={[styles.branchItem, isActive && styles.branchItemActive]}
                  onPress={() => handleSwitchCompany(company)}
                  disabled={switching}
                  activeOpacity={0.7}
                >
                  <View style={[styles.branchIcon, isActive && styles.branchIconActive]}>
                    <MaterialIcons
                      name={isActive ? "radio-button-checked" : "radio-button-unchecked"}
                      size={20}
                      color={isActive ? "#fff" : COLORS.primaryThemeColor}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.branchName, isActive && styles.branchNameActive]}>
                      {company.name}
                    </Text>
                    {company.phone ? (
                      <Text style={[styles.branchSub, isActive && { color: "#ffffffaa" }]}>
                        {company.phone}
                      </Text>
                    ) : null}
                  </View>
                  {isActive && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>Active</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            {switching && (
              <View style={styles.switchingOverlay}>
                <ActivityIndicator size="small" color={COLORS.primaryThemeColor} />
                <Text style={styles.switchingText}>Switching branch...</Text>
              </View>
            )}
          </View>
        )}

        {/* Version */}
        <Text style={styles.version}>Powered by 369ai  |  v{require("../../../app.json").expo.version}</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    backgroundColor: "#F2F4F8",
    paddingBottom: 100,
  },
  header: {
    backgroundColor: COLORS.primaryThemeColor,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 30,
    paddingBottom: 100,
  },
  logo: {
    width: 320,
    height: 128,
    backgroundColor: "transparent",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    marginHorizontal: 16,
    marginTop: -40,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 60,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    alignItems: "center",
  },
  avatarWrapper: {
    position: "absolute",
    top: -44,
    alignSelf: "center",
    borderRadius: 44,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryThemeColor,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 32,
    fontFamily: FONT_FAMILY.urbanistBold,
  },
  username: {
    fontSize: 22,
    fontFamily: FONT_FAMILY.urbanistBold,
    color: COLORS.primaryThemeColor,
    marginBottom: 4,
  },
  connectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 20,
  },
  connectedText: {
    fontSize: 12,
    fontFamily: FONT_FAMILY.urbanistMedium,
    color: "#4CAF50",
  },
  dividerLine: {
    width: "100%",
    height: 1,
    backgroundColor: "#ECECEC",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    width: "100%",
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    marginLeft: 14,
  },
  label: {
    fontSize: 12,
    fontFamily: FONT_FAMILY.urbanistMedium,
    color: COLORS.gray,
    marginBottom: 2,
  },
  value: {
    fontSize: 16,
    fontFamily: FONT_FAMILY.urbanistSemiBold,
    color: COLORS.primaryThemeColor,
  },
  divider: {
    height: 1,
    backgroundColor: "#F0F0F0",
  },
  // Branches Card
  branchCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  branchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  branchTitle: {
    fontSize: 18,
    fontFamily: FONT_FAMILY.urbanistBold,
    color: COLORS.primaryThemeColor,
  },
  branchItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  branchItemActive: {
    backgroundColor: COLORS.primaryThemeColor,
    borderColor: COLORS.primaryThemeColor,
  },
  branchIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryThemeColor + "15",
    marginRight: 12,
  },
  branchIconActive: {
    backgroundColor: "#ffffff30",
  },
  branchName: {
    fontSize: 15,
    fontFamily: FONT_FAMILY.urbanistSemiBold,
    color: "#333",
  },
  branchNameActive: {
    color: "#fff",
  },
  branchSub: {
    fontSize: 12,
    fontFamily: FONT_FAMILY.urbanistMedium,
    color: "#999",
    marginTop: 2,
  },
  activeBadge: {
    backgroundColor: "#ffffff30",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  activeBadgeText: {
    fontSize: 11,
    fontFamily: FONT_FAMILY.urbanistSemiBold,
    color: "#fff",
  },
  switchingOverlay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
  },
  switchingText: {
    fontSize: 13,
    fontFamily: FONT_FAMILY.urbanistMedium,
    color: COLORS.primaryThemeColor,
  },
  version: {
    fontSize: 11,
    fontFamily: FONT_FAMILY.urbanistMedium,
    color: "#B0B0B0",
    textAlign: "center",
    marginTop: 20,
  },
});

export default ProfileScreen;
