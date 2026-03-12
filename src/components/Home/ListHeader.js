import React from "react";
import { View, StyleSheet } from "react-native";
import Text from "@components/Text";
import { COLORS, FONT_FAMILY } from "@constants/theme";

const ListHeader = ({ title, subtitle }) => {
  return (
    <View style={styles.container}>
      <View style={styles.accent} />
      <View style={styles.inner}>
        <Text style={styles.text}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primaryThemeColor,
    marginTop: 4,
    marginBottom: 8,
  },
  accent: {
    width: 4,
    height: 32,
    borderRadius: 2,
    backgroundColor: COLORS.tabColor,
    marginRight: 12,
  },
  inner: {
    flex: 1,
  },
  text: {
    fontSize: 17,
    fontFamily: FONT_FAMILY.urbanistExtraBold,
    color: COLORS.white,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: FONT_FAMILY.urbanistMedium,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },
});

export default ListHeader;
