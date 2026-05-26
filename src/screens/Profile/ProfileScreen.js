import React, { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "@components/containers";
import { COLORS, FONT_FAMILY } from "@constants/theme";
import { useAuthStore } from "@stores/auth";

// Responsive sizing. Logo cap is tighter because the oval has 60px
// padding; header / card-overlap scale with screen height. All values
// cap at the original tablet numbers so tablets stay identical.
const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const ProfileScreen = () => {
  const navigation = useNavigation();
  const user = useAuthStore((state) => state.user);
  const initial = (user?.username || "U").charAt(0).toUpperCase();

  useEffect(() => {
    const d = Dimensions.get("window");
    console.log("[PROFILE] mount window=", d.width, "x", d.height, "scale=", d.scale);
    console.log("[PROFILE] user snapshot", {
      uid: user?.uid,
      username: user?.username,
      is_admin: user?.is_admin,
      database: user?.database,
      company_name: user?.company_name,
      branchesCount: (user?.allowed_companies || []).length,
    });
  }, []);

  const details = [
    { icon: "fingerprint", label: "User ID", value: user?.uid ?? "-", color: "#2196F3" },
    { icon: "storage", label: "Database", value: user?.database ?? "-", color: "#FF9800" },
    { icon: "admin-panel-settings", label: "Role", value: user?.is_admin ? "Admin" : "User", color: "#9C27B0" },
    { icon: "business", label: "Current Branch", value: user?.company_name || "-", color: "#00897B" },
  ];

  // Branch switching now lives on the Login screen (bottom-sheet picker
  // after auth). To change branch, the user logs out and back in.

  return (
    <SafeAreaView backgroundColor={COLORS.primaryThemeColor}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Banner */}
        <View
          style={styles.header}
          onLayout={(e) => {
            const l = e?.nativeEvent?.layout;
            console.log("[PROFILE] header LAYOUT", l);
            console.log("[PROFILE] blue band height", l?.height, "(extended bg)");
          }}
        >
          <View
            style={styles.logoOval}
            onLayout={(e) => console.log("[PROFILE] logoOval LAYOUT", e?.nativeEvent?.layout)}
          >
            <Image
              source={require("@assets/images/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Profile Card */}
        <View
          style={styles.card}
          onLayout={(e) => console.log("[PROFILE] card LAYOUT", e?.nativeEvent?.layout)}
        >
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

          {/* App Banners — visually distinct admin shortcut. Tinted pink
              container, solid icon tile, Admin pill, chevron. */}
          <TouchableOpacity
            style={styles.bannersRow}
            activeOpacity={0.85}
            onPress={() => {
              console.log("[PROFILE] banners row tap → BannersScreen");
              navigation.navigate("BannersScreen");
            }}
            onLayout={(e) => console.log("[PROFILE] bannersRow LAYOUT", e?.nativeEvent?.layout)}
          >
            <View style={styles.bannersIconBox}>
              <MaterialIcons name="image" size={22} color="#fff" />
            </View>
            <View style={styles.bannersText}>
              <Text style={styles.bannersTitle}>App Banners</Text>
              <Text style={styles.bannersSubtitle}>Manage home-screen banners</Text>
            </View>
            <View style={styles.adminPill}>
              <Text style={styles.adminPillText}>Admin</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

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
    // 16% of screen height (caps at 200 on tablets). Keeps the blue
    // band proportional to the device — same visual weight everywhere.
    paddingBottom: Math.min(screenHeight * 0.16, 200),
  },
  logoOval: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 30,
    paddingVertical: 14,
    // Very large radius forms an oval/pill regardless of inner content.
    borderRadius: 80,
    shadowColor: "#000",
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
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
    // -8% of screen height (caps at -100 on tablets). Card overlaps the
    // header proportionally so avatar/username position stays consistent.
    marginTop: -Math.min(screenHeight * 0.08, 100),
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
  // Unique-looking App Banners shortcut row
  bannersRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FCE4EC",
    width: "100%",
  },
  bannersIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#E91E63",
    alignItems: "center",
    justifyContent: "center",
  },
  bannersText: {
    flex: 1,
    marginLeft: 12,
  },
  bannersTitle: {
    fontSize: 15,
    fontFamily: FONT_FAMILY.urbanistBold,
    color: COLORS.primaryThemeColor,
  },
  bannersSubtitle: {
    fontSize: 11,
    fontFamily: FONT_FAMILY.urbanistMedium,
    color: "#7a4664",
    marginTop: 2,
  },
  adminPill: {
    backgroundColor: "#E91E63",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 6,
  },
  adminPillText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: FONT_FAMILY.urbanistBold,
    letterSpacing: 0.4,
  },
  version: {
    fontSize: 11,
    fontFamily: FONT_FAMILY.urbanistMedium,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginTop: 20,
  },
});

export default ProfileScreen;
