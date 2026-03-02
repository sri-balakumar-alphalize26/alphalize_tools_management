import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { SafeAreaView, RoundedContainer } from "@components/containers";
import NavigationHeader from "@components/Header/NavigationHeader";
import { COLORS, SPACING, BORDER_RADIUS } from "@constants/theme";

const options = [
  {
    id: "1",
    title: "Tool Management",
    subtitle: "Tools, rentals, customers & pricing",
    screen: "ToolManagementScreen",
    icon: "🔧",
    color: "#E65100",
  },
];

const OptionsScreen = ({ navigation }) => {
  const renderOption = ({ item }) => (
    <TouchableOpacity
      style={styles.optionItem}
      onPress={() => navigation.navigate(item.screen)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconBox, { backgroundColor: item.color + "20" }]}>
        <Text style={styles.iconText}>{item.icon}</Text>
      </View>
      <View style={styles.optionInfo}>
        <Text style={styles.optionTitle}>{item.title}</Text>
        <Text style={styles.optionSubtitle}>{item.subtitle}</Text>
      </View>
      <Text style={styles.arrow}>{">"}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView>
      <NavigationHeader title="Options" navigation={navigation} />
      <RoundedContainer>
        <FlatList
          data={options}
          renderItem={renderOption}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      </RoundedContainer>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  listContent: {
    padding: SPACING.paddingMedium,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.paddingMedium,
    marginBottom: SPACING.marginSmall,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  iconText: {
    fontSize: 22,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.black,
  },
  optionSubtitle: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  arrow: {
    fontSize: 18,
    color: COLORS.gray,
    fontWeight: "bold",
  },
});

export default OptionsScreen;
