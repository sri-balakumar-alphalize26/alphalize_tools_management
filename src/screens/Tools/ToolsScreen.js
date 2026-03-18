import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  Dimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView, RoundedContainer } from "@components/containers";
import NavigationHeader from "@components/Header/NavigationHeader";
import { COLORS, SPACING, BORDER_RADIUS } from "@constants/theme";
import useToolStore from "@stores/toolManagement/useToolStore";
import useAuthStore from "@stores/auth/useAuthStore";

const STATES = [
  { label: "All", value: "all" },
  { label: "Available", value: "available", color: "#4CAF50" },
  { label: "Rented", value: "rented", color: "#FF9800" },
  { label: "Maintenance", value: "maintenance", color: "#F44336" },
  { label: "Retired", value: "retired", color: "#9E9E9E" },
];

const STATUS_COLORS = {
  available: "#4CAF50",
  rented: "#FF9800",
  maintenance: "#F44336",
  retired: "#9E9E9E",
};

const STATUS_LABELS = {
  available: "Available",
  rented: "Checked Out",
  maintenance: "Maintenance",
  retired: "Retired",
};

const NUM_COLUMNS = 2;
const CARD_GAP = 10;
const screenWidth = Dimensions.get("window").width;
const cardWidth = (screenWidth - SPACING.paddingMedium * 2 - CARD_GAP) / NUM_COLUMNS;

const ToolsScreen = ({ navigation, route }) => {
  const categoryName = route?.params?.categoryName || "All Tools";
  const categoryId = route?.params?.categoryId;
  const odooAuth = useAuthStore((s) => s.odooAuth);
  const allTools = useToolStore((s) => s.tools);
  const fetchTools = useToolStore((s) => s.fetchTools);
  const tools = categoryId
    ? allTools.filter((t) => t.category_id === categoryId)
    : allTools;
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useFocusEffect(
    useCallback(() => {
      if (odooAuth) {
        fetchTools(odooAuth);
      }
    }, [odooAuth])
  );

  const filteredTools = tools.filter((t) => {
    if (activeFilter !== "all" && t.state !== activeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return (
        (t.name && t.name.toLowerCase().includes(q)) ||
        (t.code && t.code.toLowerCase().includes(q)) ||
        (t.serial_number && t.serial_number.toLowerCase().includes(q)) ||
        (t.barcode && t.barcode.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const renderFilterTabs = () => (
    <View style={styles.filterRow}>
      {STATES.map((s) => (
        <TouchableOpacity
          key={s.value}
          style={[
            styles.filterTab,
            activeFilter === s.value && styles.filterTabActive,
          ]}
          onPress={() => setActiveFilter(s.value)}
        >
          <Text
            style={[
              styles.filterTabText,
              activeFilter === s.value && styles.filterTabTextActive,
            ]}
          >
            {s.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderTool = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() =>
        navigation.navigate("ToolFormScreen", { tool: item, mode: "edit" })
      }
    >
      {/* Status badge */}
      <View
        style={[
          styles.statusBadge,
          { backgroundColor: STATUS_COLORS[item.state] || COLORS.gray },
        ]}
      >
        <Text style={styles.statusText}>
          {STATUS_LABELS[item.state] || item.state}
        </Text>
      </View>

      {/* Image */}
      <View style={styles.imageWrap}>
        {item.image ? (
          <Image
            source={{ uri: `data:image/png;base64,${item.image}` }}
            style={styles.toolImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.noImage}>
            <Text style={styles.noImageText}>No Image</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.cardInfo}>
        <Text style={styles.toolName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.toolCode} numberOfLines={1}>{item.code || "No code"}</Text>

        <View style={styles.priceRow}>
          {parseFloat(item.rental_price_per_day) > 0 ? (
            <Text style={styles.priceText}>
              ر.ع.{parseFloat(item.rental_price_per_day).toFixed(3)}
              <Text style={styles.perDay}>/day</Text>
            </Text>
          ) : (
            <Text style={styles.noPriceText}>No pricing</Text>
          )}
        </View>

        {parseFloat(item.late_fee_per_day) > 0 && (
          <Text style={styles.lateFeeText}>
            Late: ر.ع.{parseFloat(item.late_fee_per_day).toFixed(3)}/day
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No tools found</Text>
      <Text style={styles.emptySubText}>Tap + to add a new tool</Text>
    </View>
  );

  return (
    <SafeAreaView>
      <NavigationHeader
        title={categoryName}
        navigation={navigation}
        rightComponent={
          <TouchableOpacity
            onPress={() =>
              navigation.navigate("ToolFormScreen", {
                mode: "create",
                categoryName,
                categoryId,
              })
            }
            style={styles.addBtn}
          >
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        }
      />
      <RoundedContainer>
        {renderFilterTabs()}
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, code, serial, barcode..."
            placeholderTextColor="#aaa"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <FlatList
          data={filteredTools}
          renderItem={renderTool}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLUMNS}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
        />
      </RoundedContainer>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: SPACING.paddingMedium,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 6,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
  },
  filterTabActive: {
    backgroundColor: COLORS.primaryThemeColor,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.gray,
  },
  filterTabTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: SPACING.paddingMedium,
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: BORDER_RADIUS.medium,
    backgroundColor: "#fff",
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333",
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  clearBtnText: {
    fontSize: 16,
    color: COLORS.gray,
    fontWeight: "600",
  },
  list: {
    padding: SPACING.paddingMedium,
    flexGrow: 1,
  },
  gridRow: {
    justifyContent: "space-between",
    marginBottom: CARD_GAP,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.medium,
    width: cardWidth,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  statusBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 9,
    color: COLORS.white,
    fontWeight: "700",
  },
  imageWrap: {
    width: "100%",
    height: cardWidth * 0.7,
    backgroundColor: "#fafafa",
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  toolImage: {
    width: "80%",
    height: "80%",
  },
  noImage: {
    justifyContent: "center",
    alignItems: "center",
  },
  noImageText: {
    fontSize: 12,
    color: "#ccc",
    fontStyle: "italic",
  },
  cardInfo: {
    padding: 10,
  },
  toolName: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.black,
  },
  toolCode: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 2,
  },
  priceRow: {
    marginTop: 8,
  },
  priceText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.black,
  },
  perDay: {
    fontSize: 12,
    fontWeight: "400",
    color: COLORS.gray,
  },
  noPriceText: {
    fontSize: 12,
    color: COLORS.gray,
    fontStyle: "italic",
  },
  lateFeeText: {
    fontSize: 11,
    color: "#F44336",
    marginTop: 2,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  addBtnText: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: "bold",
    marginTop: -2,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.gray,
  },
  emptySubText: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 6,
  },
});

export default ToolsScreen;
