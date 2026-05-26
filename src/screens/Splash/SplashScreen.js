import React, { useEffect } from "react";
import { View, Image, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Text from "@components/Text";
import { COLORS, FONT_FAMILY } from "@constants/theme";
import { useAuthStore } from "@stores/auth";
import { setOdooUrl } from "@api/config/odooConfig";
import { setActiveCurrency, setActiveDigits } from "@utils/currency";
import { refreshCurrencyFromStorage } from "@api/services/currencyApi";

const SplashScreen = () => {
  const navigation = useNavigation();

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      // Hydrate currency + decimal accuracy from AsyncStorage so the first
      // paint of AppNavigator / LoginScreen already shows the right symbol.
      try {
        const pairs = await AsyncStorage.multiGet(["currencyConfig", "decimalAccuracy"]);
        if (pairs[0][1]) {
          const cfg = JSON.parse(pairs[0][1]);
          if (cfg && typeof cfg === "object") {
            setActiveCurrency(cfg);
            useAuthStore.getState().setCurrency(cfg);
          }
        }
        if (pairs[1][1]) {
          const digits = JSON.parse(pairs[1][1]);
          if (digits && typeof digits === "object") {
            setActiveDigits(digits);
            useAuthStore.getState().setDecimalAccuracy(digits);
          }
        }
      } catch (_) {}

      // Device-config gate
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

      // If logged in, force a fresh currency fetch from Odoo BEFORE
      // navigating. Bounded by 6s so a slow/dead server can't strand the
      // user on Splash. On success, push to both the Zustand store and the
      // module-level cache so the first paint uses the latest.
      if (isLoggedIn) {
        try {
          const fresh = await Promise.race([
            refreshCurrencyFromStorage(),
            new Promise((resolve) => setTimeout(() => resolve(null), 6000)),
          ]);
          if (fresh && !cancelled) {
            if (fresh.symbol || fresh.name) {
              useAuthStore.getState().setCurrency(fresh);
            }
            if (fresh._digitsMap) {
              useAuthStore.getState().setDecimalAccuracy(fresh._digitsMap);
            }
          }
        } catch (_) {}
      }

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
