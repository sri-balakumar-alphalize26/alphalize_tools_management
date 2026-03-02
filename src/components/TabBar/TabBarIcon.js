import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "@constants/theme";

const TabBarIcon = ({ label, focused }) => {
  return (
    <View style={styles.container}>
      <Text style={[styles.label, focused && styles.labelActive]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 2,
  },
  labelActive: {
    color: COLORS.button,
    fontWeight: "600",
  },
});

export default TabBarIcon;
