import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, SPACING } from "@constants/theme";

const EmptyState = ({ message = "No data found", icon }) => {
  return (
    <View style={styles.container}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={styles.message}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.paddingLarge,
  },
  iconContainer: {
    marginBottom: SPACING.marginMedium,
  },
  message: {
    fontSize: 16,
    color: COLORS.gray,
    textAlign: "center",
  },
});

export default EmptyState;
