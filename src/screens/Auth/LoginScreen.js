import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { useFocusEffect } from "@react-navigation/native";

import { COLORS, FONT_FAMILY } from "@constants/theme";
import { Button } from "@components/common/Button";
import Text from "@components/Text";
import { SafeAreaView } from "@components/containers";
import { useAuthStore } from "@stores/auth";
import useToolStore from "@stores/toolManagement/useToolStore";
import { showToastMessage } from "@components/Toast";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { odooAuthenticate } from "@api/services/odooApi";
import { fetchUserCompanies, switchCompany } from "@api/services/odooService";
import { getOdooUrl, setOdooUrl } from "@api/config/odooConfig";
import * as deviceApi from "@api/services/deviceApi";
import { getDeviceName } from "@utils/deviceInfo";
import { fetchCompanyCurrency, fetchUserCompanyId, fetchDecimalAccuracy } from "@api/services/currencyApi";
import { saveCurrencyConfig } from "@utils/currency";
import BranchPickerSheet from "@components/Auth/BranchPickerSheet";

// Module-level so the styles factory can use them. Logo and
// bottom-section padding cap at the original tablet values and shrink
// proportionally on phones — same pattern as employee_attendance.
const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const LoginScreen = ({ navigation }) => {
  const setUser = useAuthStore((state) => state.login);

  const [serverUrl, setServerUrl] = useState("");
  const [dbName, setDbName] = useState("");
  const [inputs, setInputs] = useState({ username: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [autoFill, setAutoFill] = useState(false);

  // Branch picker sheet — shown after auth when user has 2+ branches.
  const [showBranchSheet, setShowBranchSheet] = useState(false);
  const [pendingCtx, setPendingCtx] = useState(null); // { userData, odooAuth, companies }

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
    // Clear this field's error as soon as the user types, so only the field
    // that's actually wrong/empty at submit stays red.
    setErrors((prev) => {
      if (!prev[input]) return prev;
      console.log("[LOGIN] cleared error for", input);
      return { ...prev, [input]: null };
    });
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
          // Clear any stale red lines on the fields we just populated.
          setErrors((prev) => ({ ...prev, username: null, password: null }));
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

    console.log("[LOGIN] validate — invalid", {
      username: !inputs.username,
      password: !inputs.password,
    });

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

  // Finalize login after we know which branch to use. Called either
  // directly (single-branch users) or after the user picks in the
  // BranchPickerSheet (multi-branch users).
  const finalizeLogin = async (userData, odooAuth) => {
    // Wipe any cached tool/order data from a previous branch/session so the
    // new branch loads fresh. The tool store keeps an in-memory staleness
    // cache that survives logout/login (only a full app restart clears it),
    // so without this a re-login within 30s would show the OLD branch's
    // rental orders + tools. clearData() resets both the data + timestamps.
    const company = userData?.company_name || "(none)";
    const companyId = Array.isArray(userData?.company_id)
      ? userData.company_id[0]
      : userData?.company_id;
    console.log(`[BRANCH] finalizeLogin clearing previous branch cache before loading "${company}" (${companyId})`);

    // Scope every Odoo RPC call to the selected branch. callOdoo reads
    // auth.companyId and injects the `allowed_company_ids` context — the same
    // thing Odoo's web company switcher does — so search_read/read return
    // only THIS branch's records instead of all allowed companies. Set it on
    // odooAuth (persisted by authStore) BEFORE clearData/fetch so the forced
    // fetchAllData below already runs company-scoped.
    odooAuth.companyId = companyId;
    console.log(`[BRANCH] scoping Odoo calls to company ${companyId}`);

    useToolStore.getState().clearData();

    // Proactively load the NEW branch's data right away (fire-and-forget,
    // force=true). The landing screen after login is Home/Banner — not
    // ToolManagement — so without this the rental orders + tools aren't
    // fetched until the user opens that tab. Forcing it here both preloads
    // the data and emits the [BRANCH] fetch logs at switch time.
    useToolStore.getState().fetchAllData(odooAuth, true);

    // Set Zustand store FIRST (synchronous) — the rest of the app can
    // start rendering immediately from this. AsyncStorage writes are
    // fire-and-forget so they don't add latency to the navigation.
    setUser(userData, odooAuth, serverUrl);

    AsyncStorage.multiSet([
      ["last_login_username", inputs.username],
      ["last_login_password", inputs.password],
      ["savedCredentials", JSON.stringify({ baseUrl: serverUrl, db: dbName, password: inputs.password })],
      ["userData", JSON.stringify(userData)],
    ]).catch(() => {});

    // Fire-and-forget post-login currency fetch — copied verbatim from
    // the previous login() body. Doesn't block navigation.
    (async () => {
        console.log("[CURRENCY] post-login fetch begin", { uid: odooAuth.uid });
        try {
          let companyId = Array.isArray(userData?.company_id)
            ? userData.company_id[0]
            : (userData?.company_id || null);
          if (!companyId) {
            try {
              companyId = await fetchUserCompanyId(serverUrl, dbName, odooAuth.uid, inputs.password);
              console.log("[CURRENCY] post-login resolved companyId", companyId);
            } catch (e) {
              console.warn("[CURRENCY] post-login resolve-companyId failed", e?.message || e);
              return;
            }
          }
          const cfg = await fetchCompanyCurrency(
            serverUrl, dbName, odooAuth.uid, inputs.password, companyId
          );
          if (cfg && (cfg.symbol || cfg.name)) {
            await saveCurrencyConfig(cfg);
            useAuthStore.getState().setCurrency(cfg);
            console.log("[CURRENCY] post-login fetch applied", { symbol: cfg.symbol });
          } else {
            console.warn("[CURRENCY] post-login fetch returned empty cfg", cfg);
          }
        } catch (e) {
          console.warn("[CURRENCY] post-login currency fetch threw", e?.message || e);
        }

        try {
          const digitsMap = await fetchDecimalAccuracy(
            serverUrl, dbName, odooAuth.uid, inputs.password
          );
          await AsyncStorage.setItem("decimalAccuracy", JSON.stringify(digitsMap));
          useAuthStore.getState().setDecimalAccuracy(digitsMap);
          console.log("[CURRENCY] post-login digits applied", { keys: Object.keys(digitsMap || {}).length });
        } catch (e) {
          console.warn("[CURRENCY] post-login digits fetch threw", e?.message || e);
        }
    })();

    showToastMessage("Logged in");
    // RESET (not navigate) so LoginScreen is removed from the back stack.
    // With navigate(), LoginScreen lingered underneath AppNavigator and the
    // hardware back button popped back to it — showing Login again despite
    // being logged in. reset() makes back from home exit the app instead.
    console.log("[AUTH] finalizeLogin reset → AppNavigator (clearing login from back stack)");
    navigation.reset({ index: 0, routes: [{ name: "AppNavigator" }] });
  };

  // Auth + decide single-branch vs multi-branch flow.
  const login = async () => {
    setLoading(true);
    try {
      const odooAuth = await odooAuthenticate(dbName, inputs.username, inputs.password);
      console.log("[BRANCH] login auth ok", { uid: odooAuth?.uid });

      // Real admin status from the Odoo session (not hardcoded) so Profile role
      // + the requiresAdmin gates reflect the actual user.
      const isAdmin = !!odooAuth.is_admin;
      console.log("[AUTH] is_admin", isAdmin);

      let companyInfo = { current_company_id: null, current_company_name: "", allowed_companies: [] };
      try {
        companyInfo = await fetchUserCompanies(odooAuth);
      } catch (_) {}
      console.log("[BRANCH] login companies fetched count=" + (companyInfo.allowed_companies?.length || 0));

      const userData = {
        username: inputs.username,
        uid: odooAuth.uid,
        is_admin: isAdmin,
        is_superuser: !!odooAuth.is_system || odooAuth.uid === 1,
        database: dbName,
        company_id: companyInfo.current_company_id,
        company_name: companyInfo.current_company_name,
        allowed_companies: companyInfo.allowed_companies,
      };

      const branches = companyInfo.allowed_companies || [];
      if (branches.length <= 1) {
        // 0 or 1 branch → no picker, proceed straight to AppNavigator.
        console.log(`[BRANCH] login auto-selected "${companyInfo.current_company_name || "(none)"}" (only branch)`);
        await finalizeLogin(userData, odooAuth);
      } else {
        // 2+ branches → show picker. Login button stops spinning;
        // sheet covers screen until user picks.
        console.log(`[BRANCH] login sheet shown ${branches.length} branches (default=${companyInfo.current_company_id})`);
        setPendingCtx({ userData, odooAuth, companies: branches });
        setShowBranchSheet(true);
      }
    } catch (error) {
      showToastMessage(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // Called when user picks a branch in the BranchPickerSheet.
  const handleBranchPicked = async (branch) => {
    if (!pendingCtx) return;
    const { userData, odooAuth } = pendingCtx;
    console.log(`[BRANCH] login sheet picked "${branch.name}" (${branch.id})`);
    setShowBranchSheet(false);
    setLoading(true);

    try {
      // Switch Odoo's active company if it differs from the pre-login default.
      if (branch.id !== userData.company_id) {
        console.log("[BRANCH] login switchCompany begin", { uid: odooAuth.uid, companyId: branch.id });
        try {
          await switchCompany(odooAuth, branch.id);
          console.log("[BRANCH] login switchCompany ok", { uid: odooAuth.uid, companyId: branch.id });
        } catch (e) {
          console.warn("[BRANCH] login switchCompany failed", e?.message || e);
          showToastMessage("Failed to switch branch. Logging in with default.");
        }
      }

      const finalUserData = {
        ...userData,
        company_id: branch.id,
        company_name: branch.name,
      };
      await finalizeLogin(finalUserData, odooAuth);
    } finally {
      setLoading(false);
      setPendingCtx(null);
    }
  };

  // One-time mount log so we can see the viewport dimensions in Metro.
  useEffect(() => {
    const d = Dimensions.get("window");
    console.log("[LOGIN] mount window=", d.width, "x", d.height, "scale=", d.scale);
  }, []);

  // FORCE: never display Login while a session is active. Fires on every
  // focus — including when back-navigation reveals a leftover LoginScreen or
  // restored nav state lands here — and bounces straight to the app. Waits
  // for auth rehydration first so a cold/warm start doesn't misread
  // isLoggedIn before AsyncStorage has restored it. The ONLY time the form
  // is allowed to show is when isLoggedIn is false (fresh install / after
  // an explicit logout, which sets the flag false before routing here).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!useAuthStore.persist.hasHydrated()) {
          console.log("[AUTH] LoginScreen waiting for auth rehydration…");
          await new Promise((resolve) => {
            const unsub = useAuthStore.persist.onFinishHydration(() => {
              unsub && unsub();
              resolve();
            });
          });
        }
        if (!active) return;

        // Ask the server for this device's current status. Catches a device
        // that was Blocked/Deactivated in Odoo while the app sat on Login —
        // bounce it to Device Setup so it can't log in. Bounded + offline
        // tolerant: a network error just lets the user stay on Login.
        try {
          const [uuid, url, db, registered] = await Promise.all([
            AsyncStorage.getItem("device_uuid"),
            AsyncStorage.getItem("device_server_url"),
            AsyncStorage.getItem("device_db_name"),
            AsyncStorage.getItem("device_registered"),
          ]);
          if (active && uuid && url && db && registered === "true") {
            const res = await Promise.race([
              deviceApi.initDevice({
                baseUrl: url,
                databaseName: db,
                deviceId: uuid,
                deviceName: getDeviceName(),
              }),
              new Promise((resolve) => setTimeout(() => resolve(null), 6000)),
            ]);
            console.log("[DEVICE] login status check =", res);
            const status = res?.status;
            if (active && (status === "blocked" || status === "deactivated")) {
              if (status === "blocked") {
                console.log(
                  `[DEVICE] login blocked — serial=${res?.serial_no || "—"} at=${res?.last_blocked || "—"}`
                );
              }
              console.log("[DEVICE] login bounce to DeviceSetup — status =", status);
              try { await AsyncStorage.removeItem("device_registered"); } catch (_) {}
              showToastMessage(
                status === "blocked"
                  ? `Device blocked (Serial ${res?.serial_no || "—"}). Contact your administrator.`
                  : "This device's session ended. Please reconnect by scanning the QR."
              );
              navigation.reset({ index: 0, routes: [{ name: "DeviceSetup" }] });
              return;
            }
          }
        } catch (e) {
          console.log("[DEVICE] login status check failed (offline tolerance) —", e?.message || e);
        }

        if (!active) return;
        const loggedIn = useAuthStore.getState().isLoggedIn;
        console.log("[AUTH] LoginScreen focus — isLoggedIn =", loggedIn);
        if (loggedIn) {
          console.log("[AUTH] LoginScreen redirecting to AppNavigator (already logged in)");
          navigation.reset({ index: 0, routes: [{ name: "AppNavigator" }] });
        }
      })();
      return () => {
        active = false;
      };
    }, [navigation])
  );

  return (
    <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
      <SafeAreaView backgroundColor="#fff">
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

        <BranchPickerSheet
          visible={showBranchSheet}
          branches={pendingCtx?.companies || []}
          defaultBranchId={pendingCtx?.userData?.company_id || null}
          onPick={handleBranchPicked}
          onClose={() => {
            console.log("[BRANCH] login sheet closed by user (back to login form)");
            setShowBranchSheet(false);
            setPendingCtx(null);
            setLoading(false);
          }}
        />
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
    // 14% of screen height (caps at 170 on tablets). Title + form land
    // at the same visual band proportionally on phones AND tablets.
    paddingTop: Math.min(screenHeight * 0.14, 170),
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
