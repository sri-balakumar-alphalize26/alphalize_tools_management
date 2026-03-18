import React from "react";
import { View, Text, StyleSheet, ScrollView, Image } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "@components/containers";
import { COLORS, FONT_FAMILY } from "@constants/theme";
import { useAuthStore } from "@stores/auth";

const ProfileScreen = () => {
  const user = useAuthStore((state) => state.user);
  const initial = (user?.username || "U").charAt(0).toUpperCase();

  const details = [
    { icon: "fingerprint", label: "User ID", value: user?.uid ?? "-", color: "#2196F3" },
    { icon: "storage", label: "Database", value: user?.database ?? "-", color: "#FF9800" },
    { icon: "admin-panel-settings", label: "Role", value: user?.is_admin ? "Admin" : "User", color: "#9C27B0" },
  ];

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
          <View style={styles.badge}>
            <MaterialIcons name="verified" size={13} color="#4CAF50" />
            <Text style={styles.badgeText}>Connected</Text>
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

        {/* Version */}
        <Text style={styles.version}>Powered by 369ai  |  v1.0.0</Text>
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
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 20,
  },
  badgeText: {
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
  version: {
    fontSize: 11,
    fontFamily: FONT_FAMILY.urbanistMedium,
    color: "#B0B0B0",
    textAlign: "center",
    marginTop: 20,
  },
});

export default ProfileScreen;
