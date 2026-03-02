import React, { useState, useEffect } from "react";
import {
  View,
  Keyboard,
  StyleSheet,
  TouchableWithoutFeedback,
} from "react-native";
import { COLORS, FONT_FAMILY } from "@constants/theme";
import { Button } from "@components/common/Button";
import { OverlayLoader } from "@components/Loader";
import Text from "@components/Text";
import { TextInput } from "@components/common/TextInput";
import { RoundedScrollContainer, SafeAreaView } from "@components/containers";
import { useAuthStore } from "@stores/auth";
import { showToastMessage } from "@components/Toast";
import { odooAuthenticate, odooGetDatabases } from "@api/services/odooApi";
import { ODOO_CONFIG } from "@api/config/odooConfig";

const LoginScreen = ({ navigation }) => {
  const setUser = useAuthStore((state) => state.login);

  const [inputs, setInputs] = useState({
    username: "",
    password: "",
    database: ODOO_CONFIG.DATABASE,
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [databases, setDatabases] = useState([]);

  useEffect(() => {
    odooGetDatabases().then((dbs) => {
      if (dbs && dbs.length > 0) {
        setDatabases(dbs);
        if (!dbs.includes(inputs.database) && dbs.length === 1) {
          setInputs((prev) => ({ ...prev, database: dbs[0] }));
        }
      }
    }).catch(() => {});
  }, []);

  const handleOnchange = (text, input) => {
    setInputs((prevState) => ({ ...prevState, [input]: text }));
  };

  const handleError = (error, input) => {
    setErrors((prevState) => ({ ...prevState, [input]: error }));
  };

  const validate = () => {
    Keyboard.dismiss();
    let isValid = true;

    if (!inputs.username) {
      handleError("Please input user name", "username");
      isValid = false;
    }
    if (!inputs.password) {
      handleError("Please input password", "password");
      isValid = false;
    }
    if (!inputs.database) {
      handleError("Please input database name", "database");
      isValid = false;
    }

    if (isValid) {
      login();
    }
  };

  const login = async () => {
    setLoading(true);
    try {
      const odooAuth = await odooAuthenticate(
        inputs.database,
        inputs.username,
        inputs.password
      );

      const userData = {
        username: inputs.username,
        uid: odooAuth.uid,
        is_admin: true,
        database: inputs.database,
      };

      setUser(userData, odooAuth);
      showToastMessage("Connected to Odoo!");
      navigation.navigate("AppNavigator");
    } catch (error) {
      showToastMessage(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
      <SafeAreaView backgroundColor={COLORS.white}>
        <OverlayLoader visible={loading} />

        <View style={styles.imageContainer}>
          <View style={styles.logoWrapper}>
            <Text
              style={{
                fontSize: 32,
                fontFamily: FONT_FAMILY.urbanistBold,
                color: COLORS.primaryThemeColor,
                textAlign: "center",
              }}
            >
              Tool Management
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: COLORS.gray,
                textAlign: "center",
                marginTop: 4,
              }}
            >
              Odoo {ODOO_CONFIG.HOST}:{ODOO_CONFIG.PORT}
            </Text>
          </View>
        </View>

        <RoundedScrollContainer
          backgroundColor={COLORS.white}
          paddingHorizontal={15}
          borderTopLeftRadius={40}
          borderTopRightRadius={40}
        >
          <View style={{ paddingTop: 8 }}>
            <View style={{ marginVertical: 5, marginHorizontal: 10 }}>
              <View style={{ marginTop: 0, marginBottom: 15 }}>
                <Text
                  style={{
                    fontSize: 25,
                    fontFamily: FONT_FAMILY.urbanistBold,
                    color: "#2e2a4f",
                    textAlign: "center",
                  }}
                >
                  Login
                </Text>
              </View>

              <TextInput
                value={inputs.database}
                onChangeText={(text) => handleOnchange(text, "database")}
                onFocus={() => handleError(null, "database")}
                label="Database"
                placeholder="Odoo database name"
                error={errors.database}
                column={true}
                login={true}
              />

              {databases.length > 1 && (
                <View style={styles.dbHint}>
                  <Text style={styles.dbHintText}>
                    Available: {databases.join(", ")}
                  </Text>
                </View>
              )}

              <TextInput
                value={inputs.username}
                onChangeText={(text) => handleOnchange(text, "username")}
                onFocus={() => handleError(null, "username")}
                label="Username"
                placeholder="Enter Username"
                error={errors.username}
                column={true}
                login={true}
              />

              <TextInput
                value={inputs.password}
                onChangeText={(text) => handleOnchange(text, "password")}
                onFocus={() => handleError(null, "password")}
                error={errors.password}
                label="Password"
                placeholder="Enter password"
                password
                column={true}
                login={true}
              />

              <View style={styles.bottom}>
                <Button title="Login to Odoo" onPress={validate} loading={loading} />
              </View>
            </View>
          </View>
        </RoundedScrollContainer>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  imageContainer: {
    alignItems: "center",
    marginBottom: "4%",
    marginTop: 60,
  },
  logoWrapper: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 8,
  },
  bottom: {
    alignItems: "center",
    marginTop: 10,
  },
  dbHint: {
    marginTop: -4,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  dbHintText: {
    fontSize: 11,
    color: COLORS.gray,
  },
});

export default LoginScreen;
