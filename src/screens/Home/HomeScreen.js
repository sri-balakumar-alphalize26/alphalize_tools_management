import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  BackHandler,
  Text,
  TouchableOpacity,
} from "react-native";
import { RoundedContainer, SafeAreaView } from "@components/containers";
import { COLORS } from "@constants/theme";
import { showToastMessage } from "@components/Toast";
import { useAuthStore } from "@stores/auth";

const HomeScreen = ({ navigation }) => {
  const [backPressCount, setBackPressCount] = useState(0);

  const handleBackPress = useCallback(() => {
    if (navigation.isFocused()) {
      if (backPressCount === 0) {
        setBackPressCount(1);
        return true;
      } else if (backPressCount === 1) {
        BackHandler.exitApp();
      }
    }
    return false;
  }, [backPressCount, navigation]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress
    );
    return () => backHandler.remove();
  }, [handleBackPress]);

  useEffect(() => {
    const timer = setTimeout(() => setBackPressCount(0), 2000);
    return () => clearTimeout(timer);
  }, [backPressCount]);

  useEffect(() => {
    if (backPressCount === 1) {
      showToastMessage("Press back again to exit");
    }
  }, [backPressCount]);

  const authUser = useAuthStore((s) => s.user);

  const navigateToScreen = (screenName) => {
    navigation.navigate(screenName);
  };

  return (
    <SafeAreaView backgroundColor={COLORS.primaryThemeColor}>
      <RoundedContainer>
        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Tool Management</Text>
          <Text style={styles.headerSubtitle}>
            Welcome, {authUser?.username || "User"}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.posSection}>
          <View style={styles.posContainer}>
            <View style={styles.buttonWrapper}>
              <TouchableOpacity
                onPress={() => navigateToScreen("OptionsScreen")}
                activeOpacity={0.8}
                style={styles.actionButton}
              >
                <View style={styles.iconCircle}>
                  <Text style={styles.iconText}>+</Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.buttonLabel}>Options</Text>
            </View>

            <View style={styles.buttonWrapper}>
              <TouchableOpacity
                onPress={() => navigateToScreen("Categories")}
                activeOpacity={0.8}
                style={styles.actionButton}
              >
                <View style={styles.iconCircle}>
                  <Text style={styles.iconText}>C</Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.buttonLabel}>Categories</Text>
            </View>

            <View style={styles.buttonWrapper}>
              <TouchableOpacity
                onPress={() => navigateToScreen("Profile")}
                activeOpacity={0.8}
                style={styles.actionButton}
              >
                <View style={styles.iconCircle}>
                  <Text style={styles.iconText}>P</Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.buttonLabel}>Profile</Text>
            </View>
          </View>

          {/* Tool Management - new option */}
          <View style={[styles.posContainer, { marginTop: 20 }]}>
            <View style={styles.buttonWrapper}>
              <TouchableOpacity
                onPress={() => navigateToScreen("ToolManagementScreen")}
                activeOpacity={0.8}
                style={[styles.actionButton, styles.tmButton]}
              >
                <View style={[styles.iconCircle, { backgroundColor: "#FFF3E0" }]}>
                  <Text style={styles.iconText}>🔧</Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.buttonLabel}>Tool{"\n"}Management</Text>
            </View>
          </View>
        </View>
      </RoundedContainer>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.primaryThemeColor,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4,
  },
  posSection: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  posContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: 30,
  },
  buttonWrapper: {
    alignItems: "center",
    maxWidth: 100,
  },
  actionButton: {
    width: 90,
    height: 90,
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 2.5,
    borderColor: "#461c8aff",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#461c8aff",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  tmButton: {
    borderColor: "#E65100",
    width: 90,
    height: 90,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#f5f0ff",
    justifyContent: "center",
    alignItems: "center",
  },
  iconText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#461c8aff",
  },
  buttonLabel: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "700",
    color: "#461c8aff",
    textAlign: "center",
    letterSpacing: 0.3,
  },
});

export default HomeScreen;
