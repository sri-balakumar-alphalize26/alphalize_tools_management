import React, { useRef } from "react";
import { View, Text, StyleSheet, Alert, Animated, Pressable } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialIcons } from "@expo/vector-icons";
import { COLORS, FONT_FAMILY } from "@constants/theme";
import { useAuthStore } from "@stores/auth";

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

  const handleLogout = (navigation) => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
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
