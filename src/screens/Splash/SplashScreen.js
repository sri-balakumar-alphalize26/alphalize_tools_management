import React, { useEffect } from "react";
import { View, Image, StyleSheet, Dimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Text from "@components/Text";
import { FONT_FAMILY } from "@constants/theme";
import { useAuthStore } from "@stores/auth";
import { setOdooUrl } from "@api/config/odooConfig";
import { setActiveCurrency, setActiveDigits } from "@utils/currency";
import { refreshCurrencyFromStorage } from "@api/services/currencyApi";
import * as deviceApi from "@api/services/deviceApi";
import { getDeviceName } from "@utils/deviceInfo";

// One-time diagnostic logs — captured at import time so they fire even if
// the component fails to mount. Tells us how Metro resolved the asset.
const SPLASH_ASSET = require("@assets/images/Splash/splash.png");
try {
  const resolved = Image.resolveAssetSource(SPLASH_ASSET);
  console.log("[SPLASH] resolved asset =", resolved);
} catch (e) {
  console.warn("[SPLASH] resolveAssetSource threw", e?.message || e);
}

const SplashScreen = () => {
  const navigation = useNavigation();

  useEffect(() => {
    const d = Dimensions.get("window");
    console.log("[SPLASH] mount window=", d.width, "x", d.height, "scale=", d.scale);

    let cancelled = false;

    const boot = async () => {
      // Hydrate currency + decimal accuracy from AsyncStorage so the first
      // paint of AppNavigator / LoginScreen already shows the right symbol.
      console.log("[CURRENCY] splash hydrate begin");
      try {
        const pairs = await AsyncStorage.multiGet(["currencyConfig", "decimalAccuracy"]);
        let cachedSymbol = null;
        let cachedDigitsKeys = 0;
        if (pairs[0][1]) {
          const cfg = JSON.parse(pairs[0][1]);
          if (cfg && typeof cfg === "object") {
            cachedSymbol = cfg.symbol || null;
            setActiveCurrency(cfg);
            useAuthStore.getState().setCurrency(cfg);
          }
        }
        if (pairs[1][1]) {
          const digits = JSON.parse(pairs[1][1]);
          if (digits && typeof digits === "object") {
            cachedDigitsKeys = Object.keys(digits).length;
            setActiveDigits(digits);
            useAuthStore.getState().setDecimalAccuracy(digits);
          }
        }
        console.log("[CURRENCY] splash cached", { symbol: cachedSymbol, digitsKeys: cachedDigitsKeys });
      } catch (e) {
        console.warn("[CURRENCY] splash hydrate failed", e?.message || e);
      }

      // Device-config gate
      let deviceUuid = null;
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
        deviceUuid = pairs[0][1];
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

      // Fire-and-forget heartbeat so Odoo's device.registry row updates its
      // last_login timestamp. Never blocks navigation.
      if (deviceUuid) {
        deviceApi.initDevice({
          baseUrl: deviceServerUrl,
          databaseName: deviceDbName,
          deviceId: deviceUuid,
          deviceName: getDeviceName(),
        }).catch(() => {});
      }

      const isLoggedIn = useAuthStore.getState().isLoggedIn;

      // If logged in, force a fresh currency fetch from Odoo BEFORE
      // navigating so the first paint already uses the latest symbol.
      // Bounded by 6s so a slow/dead server can't strand the user.
      if (isLoggedIn) {
        console.log("[CURRENCY] splash force-refresh begin");
        try {
          const fresh = await Promise.race([
            refreshCurrencyFromStorage(),
            new Promise((resolve) => setTimeout(() => resolve(null), 6000)),
          ]);
          if (!fresh) {
            console.warn("[CURRENCY] splash force-refresh timed out or returned null");
          } else if (!cancelled) {
            if (fresh.symbol || fresh.name) {
              useAuthStore.getState().setCurrency(fresh);
            }
            if (fresh._digitsMap) {
              useAuthStore.getState().setDecimalAccuracy(fresh._digitsMap);
            }
            console.log("[CURRENCY] splash force-refresh applied", {
              symbol: fresh.symbol,
              digitsKeys: Object.keys(fresh._digitsMap || {}).length,
            });
          }
        } catch (e) {
          console.warn("[CURRENCY] splash force-refresh threw", e?.message || e);
        }
      } else {
        console.log("[CURRENCY] splash force-refresh skipped (not logged in)");
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
        source={SPLASH_ASSET}
        style={styles.image}
        resizeMode="contain"
        // Android decodes a 2048x2048 source into a full ~16MB bitmap
        // before scaling. "resize" tells the native decoder to scale
        // DOWN during decode, which avoids the silent stall we hit.
        // No-op on iOS.
        resizeMethod="resize"
        fadeDuration={0}
        onLoadStart={() => console.log("[SPLASH] image load START")}
        onLoad={(e) => console.log("[SPLASH] image LOADED", e?.nativeEvent?.source)}
        onLoadEnd={() => console.log("[SPLASH] image load END")}
        onError={(e) => console.warn("[SPLASH] image ERROR", e?.nativeEvent?.error)}
        onLayout={(e) => console.log("[SPLASH] image LAYOUT", e?.nativeEvent?.layout)}
      />
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
  },
  image: {
    width: "100%",
    height: "100%",
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
