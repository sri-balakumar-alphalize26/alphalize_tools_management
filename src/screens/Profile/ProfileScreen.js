import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView, RoundedContainer } from "@components/containers";
import { Button } from "@components/common/Button";
import { COLORS } from "@constants/theme";
import { useAuthStore } from "@stores/auth";

const ProfileScreen = ({ navigation }) => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    navigation.reset({
      index: 0,
      routes: [{ name: "LoginScreen" }],
    });
  };

  return (
    <SafeAreaView backgroundColor={COLORS.primaryThemeColor}>
      <RoundedContainer>
        <View style={styles.content}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.username || "U").charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.username}>{user?.username || "User"}</Text>

          <View style={{ width: "80%", marginTop: 24 }}>
            <Button
              title="Logout"
              onPress={handleLogout}
              backgroundColor={COLORS.red}
            />
          </View>
        </View>
      </RoundedContainer>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: "center",
    paddingTop: 48,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryThemeColor,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 32,
    fontWeight: "700",
  },
  username: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.black,
  },
});

export default ProfileScreen;
