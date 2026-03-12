import React from "react";
import { View, Text, StyleSheet, ScrollView, Image } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView, RoundedContainer } from "@components/containers";
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
      <RoundedContainer>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <Image
            source={require("@assets/images/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />

          {/* Avatar + Name */}
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.username}>{user?.username || "User"}</Text>
          <View style={styles.badge}>
            <MaterialIcons name="verified" size={13} color="#4CAF50" />
            <Text style={styles.badgeText}>Connected</Text>
          </View>

          {/* Account Details */}
          <View style={styles.section}>
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
          <Text style={styles.version}>Powered by Alphalize  |  v1.0.0</Text>
        </ScrollView>
      </RoundedContainer>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  content: {
    alignItems: "center",
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 100,
  },
  logo: {
    width: 200,
    height: 80,
    marginBottom: 16,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.primaryThemeColor,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 30,
    fontFamily: FONT_FAMILY.urbanistBold,
  },
  username: {
    fontSize: 20,
    fontFamily: FONT_FAMILY.urbanistBold,
    color: COLORS.primaryThemeColor,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    marginBottom: 24,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: FONT_FAMILY.urbanistMedium,
    color: "#4CAF50",
  },
  section: {
    width: "100%",
    backgroundColor: "#F8F8FA",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    marginLeft: 12,
  },
  label: {
    fontSize: 13,
    fontFamily: FONT_FAMILY.urbanistMedium,
    color: COLORS.gray,
  },
  value: {
    fontSize: 16,
    fontFamily: FONT_FAMILY.urbanistSemiBold,
    color: COLORS.primaryThemeColor,
  },
  divider: {
    height: 1,
    backgroundColor: "#ECECEC",
  },
  version: {
    fontSize: 11,
    fontFamily: FONT_FAMILY.urbanistMedium,
    color: "#B0B0B0",
    marginTop: 8,
  },
});

export default ProfileScreen;
