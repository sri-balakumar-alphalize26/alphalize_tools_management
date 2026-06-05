import React, { useRef, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Animated, Pressable, AppState } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS, FONT_FAMILY } from "@constants/theme";
import { useAuthStore } from "@stores/auth";
import showAlert from "@components/Modal/alertHost";
import { showToastMessage } from "@components/Toast";
import * as deviceApi from "@api/services/deviceApi";
import { getDeviceName } from "@utils/deviceInfo";

import HomeScreen from "@screens/Home/HomeScreen";
import ProfileScreen from "@screens/Profile/ProfileScreen";

const Tab = createBottomTabNavigator();
const ORANGE = COLORS.tabColor;

const DummyScreen = () => null;

const AnimatedTabButton = ({ children, onPress, accessibilityState }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const focused = accessibilityState?.selected;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.35, duration: 120, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 200, useNativeDriver: true }),
    ]).start();
    if (onPress) onPress();
  };

  return (
    <Pressable onPress={handlePress} style={styles.tabButtonWrapper}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

const TabBarIcon = ({ focused, iconName, label }) => (
  <View style={styles.tabItem}>
    <View style={[styles.iconBox, focused && styles.iconBoxFocused]}>
      <MaterialIcons
        name={iconName}
        size={22}
        color={focused ? ORANGE : "rgba(255,255,255,0.6)"}
      />
    </View>
    <Text
      style={[styles.tabLabel, focused && styles.tabLabelFocused]}
      numberOfLines={1}
    >
      {label}
    </Text>
  </View>
);

const AppNavigator = () => {
  const logout = useAuthStore((state) => state.logout);
  const navigation = useNavigation();

  // In-app block/deactivate watcher. Splash + Login already gate on cold start
  // and login focus; this catches a device blocked/deactivated in Odoo *while
  // the user is actively using the app*. Polls every 15s + on app foreground.
  const checkDeviceStatus = useCallback(async () => {
    try {
      const [uuid, url, db, registered] = await Promise.all([
        AsyncStorage.getItem("device_uuid"),
        AsyncStorage.getItem("device_server_url"),
        AsyncStorage.getItem("device_db_name"),
        AsyncStorage.getItem("device_registered"),
      ]);
      if (!uuid || !url || !db || registered !== "true") return;

      const res = await deviceApi.initDevice({
        baseUrl: url,
        databaseName: db,
        deviceId: uuid,
        deviceName: getDeviceName(),
      });
      const status = res?.status;
      console.log("[DEVICE] in-app block check — status =", status);
      if (status === "blocked" || status === "deactivated") {
        if (status === "blocked") {
          console.log(
            `[DEVICE] in-app blocked — serial=${res?.serial_no || "—"} at=${res?.last_blocked || "—"}`
          );
        }
        console.log("[DEVICE] in-app bounce to DeviceSetup — status =", status);
        logout();
        try { await AsyncStorage.removeItem("device_registered"); } catch (_) {}
        showToastMessage(
          status === "blocked"
            ? `Device blocked (Serial ${res?.serial_no || "—"}). Contact your administrator.`
            : "This device's session ended. Please reconnect by scanning the QR."
        );
        navigation.reset({ index: 0, routes: [{ name: "DeviceSetup" }] });
      }
    } catch (e) {
      // Offline / unreachable — can't verify, so don't kick the user out.
      console.log("[DEVICE] in-app block check failed (offline tolerance) —", e?.message || e);
    }
  }, [logout, navigation]);

  useEffect(() => {
    checkDeviceStatus(); // initial check on entering the app
    const interval = setInterval(checkDeviceStatus, 5000); // every 5s
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") checkDeviceStatus();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [checkDeviceStatus]);

  const handleLogout = (navigation) => {
    showAlert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "OK",
        style: "destructive",
        onPress: () => {
          logout();
          navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
        },
      },
    ]);
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: "absolute",
          bottom: 8,
          left: 12,
          right: 12,
          borderRadius: 20,
          elevation: 10,
          shadowColor: "#000",
          shadowOpacity: 0.15,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
          height: 68,
          backgroundColor: COLORS.primaryThemeColor,
          borderTopWidth: 0,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarButton: (props) => <AnimatedTabButton {...props} />,
          tabBarIcon: ({ focused }) => (
            <TabBarIcon focused={focused} iconName="home" label="Home" />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarButton: (props) => <AnimatedTabButton {...props} />,
          tabBarIcon: ({ focused }) => (
            <TabBarIcon focused={focused} iconName="person" label="Profile" />
          ),
        }}
      />
      <Tab.Screen
        name="LogoutTab"
        component={DummyScreen}
        options={{
          tabBarButton: (props) => <AnimatedTabButton {...props} />,
          tabBarIcon: ({ focused }) => (
            <TabBarIcon focused={focused} iconName="logout" label="Logout" />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            handleLogout(navigation);
          },
        })}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabButtonWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4,
    minWidth: 70,
  },
  iconBox: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 30,
    borderRadius: 15,
  },
  iconBoxFocused: {
    backgroundColor: "rgba(243,112,33,0.15)",
    width: 52,
    height: 30,
    borderRadius: 15,
  },
  tabLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontFamily: FONT_FAMILY.urbanistMedium,
    marginTop: 3,
    letterSpacing: 0.3,
  },
  tabLabelFocused: {
    color: ORANGE,
    fontFamily: FONT_FAMILY.urbanistBold,
  },
});

export default AppNavigator;
