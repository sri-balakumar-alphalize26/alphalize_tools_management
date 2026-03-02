import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView, RoundedContainer } from "@components/containers";
import { COLORS, SPACING, BORDER_RADIUS } from "@constants/theme";

const CATEGORIES = [
  { id: "1", name: "Power Tools", code: "PWR", toolCount: 0 },
  { id: "2", name: "Hand Tools", code: "HND", toolCount: 0 },
  { id: "3", name: "Heavy Equipment", code: "HVY", toolCount: 0 },
  { id: "4", name: "Measuring Instruments", code: "MSR", toolCount: 0 },
  { id: "5", name: "Safety Equipment", code: "SFT", toolCount: 0 },
  { id: "6", name: "Garden & Landscaping", code: "GRD", toolCount: 0 },
  { id: "7", name: "Cleaning Equipment", code: "CLN", toolCount: 0 },
];

const CategoriesScreen = ({ navigation }) => {
  const [categories] = useState(CATEGORIES);

  const renderCategory = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() =>
        navigation.navigate("ToolsScreen", {
          categoryId: item.id,
          categoryName: item.name,
        })
      }
    >
      <View style={styles.cardLeft}>
        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{item.code}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardSub}>{item.toolCount} tools</Text>
        </View>
      </View>
      <Text style={styles.arrow}>{">"}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView>
      <RoundedContainer>
        <FlatList
          data={categories}
          renderItem={renderCategory}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      </RoundedContainer>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  list: {
    padding: SPACING.paddingMedium,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  codeBox: {
    width: 50,
    height: 50,
    borderRadius: BORDER_RADIUS.medium,
    backgroundColor: "#f0ebff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  codeText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primaryThemeColor,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.black,
  },
  cardSub: {
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

export default CategoriesScreen;
