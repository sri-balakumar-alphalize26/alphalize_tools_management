import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { COLORS } from "@constants/theme";

import HomeScreen from "@screens/Home/HomeScreen";
import CategoriesScreen from "@screens/Categories/CategoriesScreen";
import ProfileScreen from "@screens/Profile/ProfileScreen";

const Tab = createBottomTabNavigator();

const AppNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.primaryThemeColor,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
          position: "absolute",
          borderTopWidth: 0,
          elevation: 10,
        },
        tabBarActiveTintColor: COLORS.tabColor,
        tabBarInactiveTintColor: COLORS.white,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: "Home" }}
      />
      <Tab.Screen
        name="Categories"
        component={CategoriesScreen}
        options={{ tabBarLabel: "Categories" }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: "Profile" }}
      />
    </Tab.Navigator>
  );
};

export default AppNavigator;
