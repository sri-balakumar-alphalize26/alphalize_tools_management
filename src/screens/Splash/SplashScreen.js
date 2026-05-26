import React, { useEffect } from "react";
import { View, Image, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Text from "@components/Text";
import { COLORS, FONT_FAMILY } from "@constants/theme";
import useAuthStore from "@stores/auth/useAuthStore";
import { setOdooUrl } from "@api/config/odooConfig";

const SplashScreen = () => {
  const navigation = useNavigation();

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      let deviceServerUrl = null;
      let deviceDbName = null;
      let deviceRegistered = null;

      try {
        const pairs = await AsyncStorage.multiGet([
          "device_uuid",
          "device_server_url",
          "device_db_name",
          "device_registered",
        ]);
        deviceServerUrl = pairs[1][1];
        deviceDbName = pairs[2][1];
        deviceRegistered = pairs[3][1];
      } catch (_) {}

      if (cancelled) return;

      if (!deviceServerUrl || !deviceDbName || deviceRegistered !== "true") {
        navigation.reset({ index: 0, routes: [{ name: "DeviceSetup" }] });
        return;
      }

      try { setOdooUrl(deviceServerUrl); } catch (_) {}

      const isLoggedIn = useAuthStore.getState().isLoggedIn;
      if (cancelled) return;

      if (isLoggedIn) {
        navigation.reset({ index: 0, routes: [{ name: "AppNavigator" }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
      }
    };

    boot();
    return () => { cancelled = true; };
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Image
        source={require("@assets/images/logo.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <ActivityIndicator size="small" color={COLORS.primaryThemeColor} style={{ marginTop: 16 }} />
      <Text style={styles.poweredText}>Powered by 369ai</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  logo: {
    width: 280,
    height: 140,
  },
  poweredText: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    fontSize: 12,
    color: "#94a3b8",
    fontFamily: FONT_FAMILY.urbanistMedium,
    letterSpacing: 0.4,
  },
});

export default SplashScreen;
