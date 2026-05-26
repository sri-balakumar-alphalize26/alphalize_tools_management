import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Animated,
  Image,
  Keyboard,
  StyleSheet,
  TouchableWithoutFeedback,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  TextInput as RNTextInput,
  Switch,
  Dimensions,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { COLORS, FONT_FAMILY } from "@constants/theme";
import { Button } from "@components/common/Button";
import { OverlayLoader } from "@components/Loader";
import Text from "@components/Text";
import { SafeAreaView } from "@components/containers";
import { useAuthStore } from "@stores/auth";
import { showToastMessage } from "@components/Toast";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { odooAuthenticate } from "@api/services/odooApi";
import { fetchUserCompanies } from "@api/services/odooService";
import { getOdooUrl, setOdooUrl } from "@api/config/odooConfig";
import { fetchCompanyCurrency, fetchUserCompanyId, fetchDecimalAccuracy } from "@api/services/currencyApi";
import { saveCurrencyConfig } from "@utils/currency";

const LoginScreen = ({ navigation }) => {
  const setUser = useAuthStore((state) => state.login);

  const [serverUrl, setServerUrl] = useState("");
  const [dbName, setDbName] = useState("");
  const [inputs, setInputs] = useState({ username: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [autoFill, setAutoFill] = useState(false);

  // Hidden service-mode entry: 7 quick taps on "Login to continue" reveals
  // a gear icon top-right that routes back to DeviceSetup. Lets technicians
  // re-point the device to a different Odoo server without clearing app data.
  const [welcomeTapCount, setWelcomeTapCount] = useState(0);
  const [gearVisible, setGearVisible] = useState(false);
  const handleTitleTap = () => {
    setWelcomeTapCount((c) => {
      const next = c + 1;
      if (next >= 7 && !gearVisible) setGearVisible(true);
      return next;
    });
  };

  useEffect(() => {
    // Hydrate URL + DB from device config (set in DeviceSetup).
    (async () => {
      try {
        const pairs = await AsyncStorage.multiGet([
          "device_server_url",
          "device_db_name",
          "device_registered",
        ]);
        const url = pairs[0][1] || "";
        const db = pairs[1][1] || "";
        const registered = pairs[2][1];

        // Defensive gate: if the device isn't registered (or the config is
        // incomplete), bounce back to Device Setup. Splash already does
        // this, but if any stale state slipped through (e.g. gear tapped
        // in an older build that didn't clear device_registered), this
        // catches it so the user can never land on Login unregistered.
        if (!url || !db || registered !== "true") {
          navigation.reset({ index: 0, routes: [{ name: "DeviceSetup" }] });
          return;
        }

        setServerUrl(url);
        try { setOdooUrl(url); } catch (_) {}
        setDbName(db);
      } catch (_) {
        setServerUrl(getOdooUrl());
      }
    })();
  }, []);

  const shakeUsername = useRef(new Animated.Value(0)).current;
  const shakePassword = useRef(new Animated.Value(0)).current;

  const triggerShake = (animValue) => {
    Animated.sequence([
      Animated.timing(animValue, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(animValue, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(animValue, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(animValue, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(animValue, { toValue: 4, duration: 50, useNativeDriver: true }),
      Animated.timing(animValue, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleOnchange = (text, input) => {
    setInputs((prevState) => ({ ...prevState, [input]: text }));
  };

  const handleAutoFill = async (value) => {
    setAutoFill(value);
    if (value) {
      try {
        // Prefer the last successful login; fall back to the admin creds
        // entered in Device Config (used the very first time the user lands
        // here, before any login has been saved).
        const pairs = await AsyncStorage.multiGet([
          "last_login_username",
          "last_login_password",
          "device_admin_username",
          "device_admin_password",
        ]);
        const u = pairs[0][1] || pairs[2][1] || "";
        const p = pairs[1][1] || pairs[3][1] || "";
        if (u || p) {
          setInputs((prev) => ({ ...prev, username: u, password: p }));
        } else {
          showToastMessage("No saved credentials yet");
          setAutoFill(false);
        }
      } catch (_) {
        setAutoFill(false);
      }
    } else {
      setInputs((prev) => ({ ...prev, username: "", password: "" }));
    }
  };

  const handleError = (error, input) => {
    setErrors((prevState) => ({ ...prevState, [input]: error }));
  };

  const validate = () => {
    Keyboard.dismiss();
    let isValid = true;

    if (!inputs.username) {
      handleError("Please input user name", "username");
      triggerShake(shakeUsername);
      isValid = false;
    }
    if (!inputs.password) {
      handleError("Please input password", "password");
      triggerShake(shakePassword);
      isValid = false;
    }
    if (!dbName) {
      showToastMessage("Device not configured. Returning to Device Setup.");
      navigation.reset({ index: 0, routes: [{ name: "DeviceSetup" }] });
      return;
    }

    if (isValid) login();
  };

  const login = async () => {
    setLoading(true);
    try {
      const odooAuth = await odooAuthenticate(dbName, inputs.username, inputs.password);

      let companyInfo = { current_company_id: null, current_company_name: "", allowed_companies: [] };
      try {
        companyInfo = await fetchUserCompanies(odooAuth);
      } catch (_) {}

      const userData = {
        username: inputs.username,
        uid: odooAuth.uid,
        is_admin: true,
        database: dbName,
        company_id: companyInfo.current_company_id,
        company_name: companyInfo.current_company_name,
        allowed_companies: companyInfo.allowed_companies,
      };

      try {
        await AsyncStorage.multiSet([
          ["last_login_username", inputs.username],
          ["last_login_password", inputs.password],
          // Minimal savedCredentials so refreshCurrencyFromStorage() has
          // what it needs (baseUrl, db, password) to re-fetch on boot.
          [
            "savedCredentials",
            JSON.stringify({ baseUrl: serverUrl, db: dbName, password: inputs.password }),
          ],
        ]);
      } catch (_) {}

      setUser(userData, odooAuth, serverUrl);

      // Fire-and-forget post-login currency fetch. Never blocks navigation.
      // On failure the app keeps using whatever was cached in AsyncStorage.
      (async () => {
        try {
          let companyId = Array.isArray(userData?.company_id)
            ? userData.company_id[0]
            : (userData?.company_id || null);
          if (!companyId) {
            try {
              companyId = await fetchUserCompanyId(serverUrl, dbName, odooAuth.uid, inputs.password);
            } catch (_) { return; }
          }
          const cfg = await fetchCompanyCurrency(
            serverUrl, dbName, odooAuth.uid, inputs.password, companyId
          );
          if (cfg && (cfg.symbol || cfg.name)) {
            await saveCurrencyConfig(cfg);
            useAuthStore.getState().setCurrency(cfg);
          }
        } catch (_) {}

        try {
          const digitsMap = await fetchDecimalAccuracy(
            serverUrl, dbName, odooAuth.uid, inputs.password
          );
          await AsyncStorage.setItem("decimalAccuracy", JSON.stringify(digitsMap));
          useAuthStore.getState().setDecimalAccuracy(digitsMap);
        } catch (_) {}
      })();

      showToastMessage("Logged in");
      navigation.navigate("AppNavigator");
    } catch (error) {
      showToastMessage(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // One-time mount log so we can see the viewport dimensions in Metro.
  useEffect(() => {
    const d = Dimensions.get("window");
    console.log("[LOGIN] mount window=", d.width, "x", d.height, "scale=", d.scale);
  }, []);

  return (
    <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
      <SafeAreaView backgroundColor="#fff">
        <OverlayLoader visible={loading} />

        {gearVisible ? (
          <TouchableOpacity
            style={styles.gearBtn}
            activeOpacity={0.7}
            onPress={async () => {
              // Mark the device as unconfigured so the user can't escape
              // back to Login without completing a fresh setup. The Splash
              // boot gate keys off device_registered.
              try { await AsyncStorage.removeItem("device_registered"); } catch (_) {}
              navigation.reset({ index: 0, routes: [{ name: "DeviceSetup" }] });
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialIcons name="settings" size={24} color="#2e2a4f" />
          </TouchableOpacity>
        ) : null}

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* TOP WHITE SECTION: logo only */}
            <View
              style={styles.topSection}
              onLayout={(e) => console.log("[LOGIN] top section LAYOUT", e?.nativeEvent?.layout)}
            >
              <View style={styles.header}>
                <Image
                  source={require("@assets/images/logo.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
            </View>

            {/* BOTTOM PURPLE SECTION: gradient fade from white to purple
                at the top edge so it blends smoothly with the white top
                section instead of showing a hard line. Contains the
                "Welcome back" title block + form card + footer. */}
            <LinearGradient
              colors={["#ffffff", COLORS.primaryThemeColor, COLORS.primaryThemeColor]}
              locations={[0, 0.08, 1]}
              style={styles.bottomSection}
              onLayout={(e) => console.log("[LOGIN] bottom section LAYOUT", e?.nativeEvent?.layout)}
            >
              <View
                style={styles.titleBlock}
                onLayout={(e) => console.log("[LOGIN] title block LAYOUT", e?.nativeEvent?.layout)}
              >
                <TouchableOpacity activeOpacity={1} onPress={handleTitleTap}>
                  <Text style={styles.titleText}>Welcome back</Text>
                </TouchableOpacity>
                <Text style={styles.subtitleText}>Login to continue to your store</Text>
              </View>

              <View
                style={styles.card}
                onLayout={(e) => console.log("[LOGIN] card LAYOUT", e?.nativeEvent?.layout)}
              >
                {/* Username */}
                <Animated.View style={[styles.inputGroup, { transform: [{ translateX: shakeUsername }] }]}>
                  <Text style={styles.label}>Username or Email</Text>
                  <RNTextInput
                    style={styles.input}
                    value={inputs.username}
                    onChangeText={(text) => handleOnchange(text, "username")}
                    onFocus={() => handleError(null, "username")}
                    placeholder="Enter username or email"
                    placeholderTextColor="#aaa"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <View style={styles.underline} />
                  {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
                </Animated.View>

                {/* Password */}
                <Animated.View style={[styles.inputGroup, { transform: [{ translateX: shakePassword }] }]}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.passwordRow}>
                    <RNTextInput
                      style={[styles.input, { flex: 1 }]}
                      value={inputs.password}
                      onChangeText={(text) => handleOnchange(text, "password")}
                      onFocus={() => handleError(null, "password")}
                      placeholder="Enter password"
                      placeholderTextColor="#aaa"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 6 }}>
                      <MaterialIcons
                        name={showPassword ? "visibility" : "visibility-off"}
                        size={22}
                        color={COLORS.primaryThemeColor}
                      />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.underline} />
                  {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
                </Animated.View>

                {/* Auto Fill Toggle — pulls username/password persisted by Device Setup */}
                <View style={styles.autoFillRow}>
                  <Text style={styles.autoFillLabel}>Auto Fill Credentials</Text>
                  <Switch
                    value={autoFill}
                    onValueChange={handleAutoFill}
                    trackColor={{ false: "#D0D0D0", true: COLORS.primaryThemeColor }}
                    thumbColor={autoFill ? "#fff" : "#f4f3f4"}
                  />
                </View>

                <View style={styles.buttonContainer}>
                  <Button title="Login" onPress={validate} loading={loading} />
                </View>
              </View>

              <Text style={styles.footer}>Powered by 369ai  |  v{require("../../../app.json").expo.version}</Text>
            </LinearGradient>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    backgroundColor: "transparent",
  },
  topSection: {
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 12,
    alignItems: "center",
  },
  bottomSection: {
    flex: 1,
    // Background is the LinearGradient parent; no backgroundColor here.
    paddingHorizontal: 24,
    // Push welcome back + card further down into the purple so they don't
    // hug the white/purple boundary. The bottom section is ~1028px tall on
    // a 1232px screen, so 120px of top padding gives the title a relaxed
    // landing zone past the gradient fade.
    paddingTop: 170,
    paddingBottom: 30,
  },
  header: {
    alignItems: "center",
  },
  logo: {
    width: 320,
    height: 128,
    backgroundColor: "transparent",
  },
  titleBlock: {
    alignItems: "center",
    marginBottom: 18,
  },
  titleText: {
    fontSize: 26,
    fontFamily: FONT_FAMILY.urbanistBold,
    color: "#fff",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  subtitleText: {
    fontSize: 13,
    fontFamily: FONT_FAMILY.urbanistMedium,
    color: "rgba(255,255,255,0.75)",
    marginTop: 6,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 4,
      },
    }),
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontFamily: FONT_FAMILY.urbanistMedium,
    color: "#888",
    marginBottom: 0,
  },
  input: {
    fontSize: 14,
    fontFamily: FONT_FAMILY.urbanistSemiBold,
    color: COLORS.black,
    paddingVertical: 6,
    paddingHorizontal: 0,
  },
  underline: {
    height: 1,
    backgroundColor: "#D0D0D0",
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  errorText: {
    fontSize: 11,
    fontFamily: FONT_FAMILY.urbanistMedium,
    color: "#E53935",
    marginTop: 3,
  },
  autoFillRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  autoFillLabel: {
    fontSize: 13,
    fontFamily: FONT_FAMILY.urbanistMedium,
    color: COLORS.primaryThemeColor,
  },
  buttonContainer: {
    marginTop: 10,
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: FONT_FAMILY.urbanistMedium,
    color: "#B0B0B0",
    marginTop: 24,
  },
  gearBtn: {
    position: "absolute",
    top: 12,
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});

export default LoginScreen;
