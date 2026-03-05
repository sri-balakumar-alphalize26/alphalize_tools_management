import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS, SPACING } from "@constants/theme";

const NavigationHeader = ({ title, navigation, rightComponent }) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
      >
        <Text style={styles.backText}>{"<"}</Text>
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.rightContainer}>
        {rightComponent ? rightComponent : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.paddingMedium,
    paddingVertical: 12,
    backgroundColor: COLORS.primaryThemeColor,
  },
  backButton: {
    padding: SPACING.paddingSmall,
    marginRight: SPACING.marginSmall,
  },
  backText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "bold",
  },
  title: {
    flex: 1,
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "600",
  },
  rightContainer: {
    marginLeft: SPACING.marginSmall,
  },
});

export default NavigationHeader;
