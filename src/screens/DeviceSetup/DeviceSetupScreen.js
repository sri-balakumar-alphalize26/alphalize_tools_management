import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator,
  TextInput as TextInputNative,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";

import Text from "@components/Text";
import { OverlayLoader } from "@components/Loader";
import { SafeAreaView } from "@components/containers";
import { showToastMessage } from "@components/Toast";
import { FONT_FAMILY } from "@constants/theme";
import * as deviceApi from "@api/services/deviceApi";
import { generateUUIDv4 } from "@utils/uuid";
import StyledConfirmModal from "@components/Modal/StyledConfirmModal";
import { getDeviceName } from "@utils/deviceInfo";

const PURPLE = "#2E294E";
const LIGHT_PURPLE = "#eeecf5";
const BORDER = "#d0ceea";

const Field = ({ error, children }) => (
  <View style={styles.fieldGroup}>
    {children}
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
  </View>
);

const DeviceSetupScreen = () => {
  const navigation = useNavigation();

  const [serverUrl, setServerUrl] = useState("");
  const [databases, setDatabases] = useState([]);
  const [selectedDb, setSelectedDb] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [deviceUUID, setDeviceUUID] = useState("");
  const [loadingDbs, setLoadingDbs] = useState(false);
  const [loadingConfigure, setLoadingConfigure] = useState(false);
  const [dbDropdownOpen, setDbDropdownOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [moduleMissingOpen, setModuleMissingOpen] = useState(false);
  const [scanPromptOpen, setScanPromptOpen] = useState(false);
  const [hidePassword, setHidePassword] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        let uuid = await AsyncStorage.getItem("device_uuid");
        if (!uuid) {
          uuid = generateUUIDv4();
          await AsyncStorage.setItem("device_uuid", uuid);
        }
        setDeviceUUID(uuid);
        // Form fields stay blank on every entry — user re-enters URL,
        // database, username, password from scratch.
      } catch (_) {}
    }
    init();
  }, []);

  const setError = (field, msg) => setErrors((p) => ({ ...p, [field]: msg }));
  const clearError = (field) => setErrors((p) => ({ ...p, [field]: null }));

  const normalizeUrl = (url = "") => {
    let u = url.trim();
    if (u && !u.startsWith("http")) u = "http://" + u;
    return u.replace(/\/+$/, "");
  };

  const handleFetchDatabases = async () => {
    Keyboard.dismiss();
    if (!serverUrl.trim()) return;
    clearError("serverUrl");
    setLoadingDbs(true);
    setDatabases([]);
    setSelectedDb("");
    setDbDropdownOpen(false);

    try {
      const dbs = await deviceApi.fetchDatabases(normalizeUrl(serverUrl));
      if (!dbs || dbs.length === 0) {
        setError("serverUrl", "Could not fetch databases — check the URL and try again");
      } else {
        setDatabases(dbs);
        setDbDropdownOpen(true);
      }
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("timeout")) {
        setError("serverUrl", "Connection timed out — is the server running?");
      } else if (msg.includes("Network Error") || msg.includes("ECONNREFUSED")) {
        setError("serverUrl", "Cannot reach server — check the IP address and port");
      } else if (msg.includes("404")) {
        setError("serverUrl", "Server found but database listing is disabled or module not installed");
      } else {
        setError("serverUrl", `Cannot fetch databases: ${msg}`);
      }
    } finally {
      setLoadingDbs(false);
    }
  };

  const handleConfigure = async () => {
    Keyboard.dismiss();
    let valid = true;
    if (!serverUrl.trim()) { setError("serverUrl", "Server URL is required"); valid = false; }
    if (!selectedDb) { setError("db", "Select a database"); valid = false; }
    if (!username.trim()) { setError("username", "Username is required"); valid = false; }
    if (!password.trim()) { setError("password", "Password is required"); valid = false; }
    if (!valid) return;

    const base = normalizeUrl(serverUrl);
    setLoadingConfigure(true);
    try {
      const session = await deviceApi.authenticate(base, selectedDb, username.trim(), password);
      if (!session.uid || session.uid === false) {
        setError("username", "Invalid username or password");
        return;
      }

      const moduleInstalled = await deviceApi.isModuleInstalled(
        base, selectedDb, session.uid, password, "device_login_config"
      );
      if (!moduleInstalled) {
        setModuleMissingOpen(true);
        return;
      }

      // Persist admin creds so the Login screen's Auto Fill toggle can read
      // them back. If the database changed, also clear the cached
      // last-login credentials — those were tied to a different DB and
      // would auto-fill the wrong user on the next Login visit.
      try {
        const prevDb = await AsyncStorage.getItem("device_db_name");
        const dbChanged = !prevDb || prevDb !== selectedDb;
        const writes = [
          ["device_admin_username", username.trim()],
          ["device_admin_password", password],
        ];
        await AsyncStorage.multiSet(writes);
        if (dbChanged) {
          await AsyncStorage.multiRemove(["last_login_username", "last_login_password"]);
        }
      } catch (_) {}

      setScanPromptOpen(true);
    } catch (err) {
      const msg = err.message || "";
      const isNetworkError = !err.response && (
        err.code === "ECONNABORTED" ||
        err.code === "ECONNREFUSED" ||
        err.code === "ENOTFOUND" ||
        err.code === "ERR_NETWORK" ||
        msg.includes("timeout") ||
        msg.includes("Network Error") ||
        msg.includes("ECONNREFUSED") ||
        msg.includes("Network request failed")
      );

      if (msg.includes("timeout") || err.code === "ECONNABORTED") {
        showToastMessage("Connection timed out. Check your network and server URL.");
      } else if (isNetworkError) {
        showToastMessage("Cannot reach server. Check the URL and ensure Odoo is running.");
      } else {
        showToastMessage(`Error: ${msg}`);
      }
    } finally {
      setLoadingConfigure(false);
    }
  };

  const isLoading = loadingDbs || loadingConfigure;

  return (
    <TouchableWithoutFeedback
      onPress={() => { Keyboard.dismiss(); setDbDropdownOpen(false); }}
    >
      <SafeAreaView backgroundColor={PURPLE}>
        <OverlayLoader visible={loadingConfigure} />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="settings" size={32} color="#fff" />
            </View>
            <Text style={styles.headerTitle}>Device Setup</Text>
            <Text style={styles.headerSubtitle}>
              Configure this device to connect to your server
            </Text>
          </View>

          <View style={styles.card}>

            <View style={styles.stepRow}>
              <View style={styles.stepBadge}><Text style={styles.stepNum}>1</Text></View>
              <Text style={styles.stepTitle}>Server URL</Text>
            </View>

            <Field error={errors.serverUrl}>
              <View style={styles.urlInputRow}>
                <TextInputNative
                  value={serverUrl}
                  onChangeText={(t) => {
                    setServerUrl(t);
                    clearError("serverUrl");
                    setDatabases([]);
                    setSelectedDb("");
                    setDbDropdownOpen(false);
                  }}
                  onFocus={() => clearError("serverUrl")}
                  onBlur={() => { if (serverUrl.trim()) handleFetchDatabases(); }}
                  onSubmitEditing={() => { if (serverUrl.trim()) handleFetchDatabases(); }}
                  placeholder="Enter the URL (http:// or https://)"
                  placeholderTextColor="#bbb"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="done"
                  style={[styles.nativeInput, styles.urlInput, errors.serverUrl && styles.inputError]}
                />
                {loadingDbs && (
                  <ActivityIndicator size="small" color={PURPLE} style={styles.urlSpinner} />
                )}
              </View>
            </Field>

            <View style={styles.divider} />

            <View style={styles.stepRow}>
              <View style={styles.stepBadge}><Text style={styles.stepNum}>2</Text></View>
              <Text style={styles.stepTitle}>Database</Text>
            </View>

            <Field error={errors.db}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  if (databases.length > 0) setDbDropdownOpen((o) => !o);
                }}
                style={[styles.nativeInput, styles.dbSelector, errors.db && styles.inputError]}
              >
                <Text style={selectedDb ? styles.dbSelectedText : styles.dbPlaceholderText}>
                  {selectedDb || (databases.length === 0 ? "Enter URL above to load databases" : "Select a database")}
                </Text>
                {databases.length > 0 && (
                  <MaterialIcons
                    name={dbDropdownOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                    size={20}
                    color="#999"
                  />
                )}
              </TouchableOpacity>

              {dbDropdownOpen && databases.length > 0 && (
                <View style={styles.dropdown}>
                  <ScrollView
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator
                    style={styles.dropdownScroll}
                  >
                    {databases.map((item) => (
                      <TouchableOpacity
                        key={item}
                        style={[styles.dropdownItem, item === selectedDb && styles.dropdownItemActive]}
                        onPress={() => {
                          setSelectedDb(item);
                          clearError("db");
                          setDbDropdownOpen(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, item === selectedDb && styles.dropdownItemTextActive]}>
                          {item}
                        </Text>
                        {item === selectedDb && (
                          <MaterialIcons name="check" size={16} color={PURPLE} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </Field>

            <View style={styles.divider} />

            <View style={styles.stepRow}>
              <View style={styles.stepBadge}><Text style={styles.stepNum}>3</Text></View>
              <Text style={styles.stepTitle}>Admin Credentials</Text>
            </View>

            <Field error={errors.username}>
              <TextInputNative
                value={username}
                onChangeText={(t) => { setUsername(t); clearError("username"); }}
                onFocus={() => clearError("username")}
                placeholder="Username"
                placeholderTextColor="#bbb"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                style={[styles.nativeInput, errors.username && styles.inputError]}
              />
            </Field>

            <Field error={errors.password}>
              <View style={styles.urlInputRow}>
                <TextInputNative
                  value={password}
                  onChangeText={(t) => { setPassword(t); clearError("password"); }}
                  onFocus={() => clearError("password")}
                  placeholder="Password"
                  placeholderTextColor="#bbb"
                  secureTextEntry={hidePassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  style={[styles.nativeInput, styles.urlInput, errors.password && styles.inputError]}
                />
                <TouchableOpacity
                  onPress={() => setHidePassword((v) => !v)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.eyeBtn}
                >
                  <MaterialIcons
                    name={hidePassword ? "visibility-off" : "visibility"}
                    size={22}
                    color={PURPLE}
                  />
                </TouchableOpacity>
              </View>
            </Field>

            <View style={styles.divider} />

            <TouchableOpacity
              style={[styles.registerBtn, isLoading && styles.btnDisabled]}
              onPress={handleConfigure}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {loadingConfigure ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.registerBtnText}>Configure Device</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.hint}>
              Your Device ID must be pre-registered by your admin.{"\n"}
              You only need to do this once per device.
            </Text>

          </View>
        </ScrollView>

        <StyledConfirmModal
          isVisible={moduleMissingOpen}
          title="Device Module Not Installed"
          message={'The "device_login_config" module is not installed on this Odoo server.\n\nPlease ask your admin to install it before configuring this device.'}
          confirmLabel="OK"
          onConfirm={() => setModuleMissingOpen(false)}
        />

        <StyledConfirmModal
          isVisible={scanPromptOpen}
          title="Ready to scan?"
          message={`Open Odoo → Device Registry → New Device on the admin screen. A QR code will appear there — scan it next.\n\nDevice Model: ${getDeviceName()}\nDevice ID: ${deviceUUID}`}
          confirmLabel="Scan QR"
          cancelLabel="Cancel"
          onConfirm={() => {
            setScanPromptOpen(false);
            navigation.navigate("DeviceQRScanner", {
              deviceUUID,
              deviceModel: getDeviceName(),
              serverUrl: normalizeUrl(serverUrl),
              databaseName: selectedDb,
            });
          }}
          onCancel={() => setScanPromptOpen(false)}
        />
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: FONT_FAMILY.urbanistBold,
    color: "#fff",
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    lineHeight: 19,
  },
  card: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    minHeight: 500,
  },
  urlInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  urlInput: {
    flex: 1,
  },
  urlSpinner: {
    position: "absolute",
    right: 14,
  },
  eyeBtn: {
    position: "absolute",
    right: 12,
    padding: 4,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: PURPLE,
    justifyContent: "center",
    alignItems: "center",
  },
  stepNum: {
    color: "#fff",
    fontSize: 12,
    fontFamily: FONT_FAMILY.urbanistBold,
  },
  stepTitle: {
    fontSize: 15,
    fontFamily: FONT_FAMILY.urbanistBold,
    color: "#2e2a4f",
    flex: 1,
  },
  fieldGroup: {
    marginBottom: 10,
  },
  nativeInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: "#222",
    backgroundColor: "#fafafa",
    fontFamily: FONT_FAMILY.urbanistBold,
  },
  inputError: {
    borderColor: "#e74c3c",
    backgroundColor: "#fff8f8",
  },
  errorText: {
    color: "#e74c3c",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 2,
  },
  dbSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dbSelectedText: {
    color: "#222",
    fontSize: 14,
    fontFamily: FONT_FAMILY.urbanistBold,
    flex: 1,
  },
  dbPlaceholderText: {
    color: "#bbb",
    fontSize: 14,
    flex: 1,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: "#fff",
    marginTop: 4,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    maxHeight: 220,
  },
  dropdownScroll: {
    maxHeight: 220,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f4",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownItemActive: {
    backgroundColor: LIGHT_PURPLE,
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#333",
  },
  dropdownItemTextActive: {
    color: PURPLE,
    fontFamily: FONT_FAMILY.urbanistBold,
  },
  registerBtn: {
    backgroundColor: "#F37021",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 14,
    elevation: 2,
    shadowColor: "#F37021",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  registerBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: FONT_FAMILY.urbanistBold,
    letterSpacing: 0.3,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  divider: {
    height: 1,
    backgroundColor: "#f0e8f4",
    marginVertical: 16,
  },
  hint: {
    fontSize: 12,
    color: "#aaa",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 4,
  },
});

export default DeviceSetupScreen;
