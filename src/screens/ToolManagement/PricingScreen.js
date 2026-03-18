import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView, RoundedContainer } from "@components/containers";
import NavigationHeader from "@components/Header/NavigationHeader";
import { COLORS, SPACING, BORDER_RADIUS } from "@constants/theme";
import useToolStore from "@stores/toolManagement/useToolStore";
import useAuthStore from "@stores/auth/useAuthStore";

const PERIOD_LABELS = {
  day: "Day",
  week: "Week",
  month: "Month",
  fixed: "Fixed",
};

const ALL_PERIODS = [
  { label: "All Periods", value: "all" },
  { label: "Per Day", value: "day" },
  { label: "Per Week", value: "week" },
  { label: "Per Month", value: "month" },
  { label: "Fixed", value: "fixed" },
];

// Simple dropdown picker component
const DropdownPicker = ({ label, value, options, onSelect }) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={dropStyles.wrapper}>
      <TouchableOpacity style={dropStyles.trigger} onPress={() => setOpen(true)}>
        <Text style={dropStyles.triggerText} numberOfLines={1}>
          {selected?.label || label}
        </Text>
        <Text style={dropStyles.arrow}>▼</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={dropStyles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={dropStyles.menu}>
            <Text style={dropStyles.menuTitle}>{label}</Text>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[dropStyles.menuItem, value === opt.value && dropStyles.menuItemActive]}
                onPress={() => { onSelect(opt.value); setOpen(false); }}
              >
                <Text style={[dropStyles.menuItemText, value === opt.value && dropStyles.menuItemTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const dropStyles = StyleSheet.create({
  wrapper: {},
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 100,
  },
  triggerText: {
    fontSize: 12,
    color: "#333",
    fontWeight: "500",
    flex: 1,
  },
  arrow: {
    fontSize: 8,
    color: COLORS.gray,
    marginLeft: 4,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  menu: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 8,
    width: 220,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.gray,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  menuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  menuItemActive: {
    backgroundColor: COLORS.primaryThemeColor + "15",
  },
  menuItemText: {
    fontSize: 14,
    color: "#333",
  },
  menuItemTextActive: {
    color: COLORS.primaryThemeColor,
    fontWeight: "600",
  },
});

const PricingScreen = ({ navigation }) => {
  const odooAuth = useAuthStore((s) => s.odooAuth);
  const pricingRules = useToolStore((s) => s.pricingRules);
  const fetchPricingRules = useToolStore((s) => s.fetchPricingRules);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedPeriod, setSelectedPeriod] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    if (!odooAuth) return;
    setRefreshing(true);
    await fetchPricingRules(odooAuth);
    setRefreshing(false);
  }, [odooAuth]);

  useFocusEffect(
    useCallback(() => {
      if (odooAuth) {
        fetchPricingRules(odooAuth, true);
      }
    }, [odooAuth])
  );

  // Extract unique categories
  const categoryOptions = useMemo(() => {
    const catSet = new Set();
    pricingRules.forEach((r) => {
      if (r.category_name) catSet.add(r.category_name);
    });
    return [
      { label: "All Categories", value: "all" },
      ...Array.from(catSet).sort().map((c) => ({ label: c, value: c })),
    ];
  }, [pricingRules]);

  // Filtered data
  const filteredRules = useMemo(() => {
    return pricingRules.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matches =
          (r.product_name && r.product_name.toLowerCase().includes(q)) ||
          (r.category_name && r.category_name.toLowerCase().includes(q)) ||
          (r.tool_name && r.tool_name.toLowerCase().includes(q));
        if (!matches) return false;
      }
      if (selectedCategory !== "all" && r.category_name !== selectedCategory) return false;
      if (selectedPeriod !== "all" && r.period_type !== selectedPeriod) return false;
      return true;
    });
  }, [pricingRules, searchQuery, selectedCategory, selectedPeriod]);

  const renderRule = ({ item, index }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.6}
      onPress={() => navigation.navigate("PricingFormScreen", { rule: item })}
    >
      <Text style={styles.cellNum}>{index + 1}</Text>
      <View style={styles.cellProduct}>
        <Text style={styles.productName} numberOfLines={1}>{item.product_name}</Text>
      </View>
      <View style={styles.cellCategory}>
        <Text style={styles.categoryText} numberOfLines={1}>
          {item.category_name || "—"}
        </Text>
      </View>
      <View style={styles.cellUnits}>
        <View style={styles.unitsBadge}>
          <Text style={styles.unitsText}>{item.serial_count}</Text>
        </View>
      </View>
      <View style={styles.cellPeriod}>
        <View style={styles.periodBadge}>
          <Text style={styles.periodText}>
            Per {PERIOD_LABELS[item.period_type] || item.period_type}
          </Text>
        </View>
      </View>
      <Text style={styles.cellPrice}>ر.ع.{item.price?.toFixed(3)}</Text>
      <Text style={styles.cellLateFee}>
        {item.late_fee_per_day > 0 ? `ر.ع.${item.late_fee_per_day.toFixed(3)}` : "—"}
      </Text>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No pricing rules found</Text>
      <Text style={styles.emptySubText}>
        {searchQuery || selectedCategory !== "all" || selectedPeriod !== "all"
          ? "Try changing your filters"
          : "Add tools first, then configure pricing."}
      </Text>
    </View>
  );

  return (
    <SafeAreaView>
      <NavigationHeader title="Pricing Rules" navigation={navigation} />
      <RoundedContainer>
        {/* Search bar */}
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
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

        {/* Dropdowns row */}
        <View style={styles.dropdownRow}>
          <DropdownPicker
            label="Category"
            value={selectedCategory}
            options={categoryOptions}
            onSelect={setSelectedCategory}
          />
          <DropdownPicker
            label="Period"
            value={selectedPeriod}
            options={ALL_PERIODS}
            onSelect={setSelectedPeriod}
          />
          <Text style={styles.countText}>
            {filteredRules.length} of {pricingRules.length}
          </Text>
        </View>

        {/* Table header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.headerText, { width: 24 }]}>#</Text>
          <Text style={[styles.headerText, { flex: 1.5 }]}>Product</Text>
          <Text style={[styles.headerText, { flex: 1 }]}>Category</Text>
          <Text style={[styles.headerText, { flex: 0.5, textAlign: "center" }]}>Units</Text>
          <Text style={[styles.headerText, { flex: 0.8, textAlign: "center" }]}>Period</Text>
          <Text style={[styles.headerText, { flex: 0.8, textAlign: "right" }]}>Price</Text>
          <Text style={[styles.headerText, { flex: 0.8, textAlign: "right" }]}>Late Fee</Text>
        </View>

        <FlatList
          data={filteredRules}
          renderItem={renderRule}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primaryThemeColor]}
              tintColor={COLORS.primaryThemeColor}
            />
          }
        />
      </RoundedContainer>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: SPACING.paddingMedium,
    marginTop: 10,
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
  dropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.paddingMedium,
    paddingVertical: 8,
    gap: 8,
  },
  countText: {
    fontSize: 11,
    color: COLORS.gray,
    marginLeft: "auto",
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  headerText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.gray,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  list: {
    flexGrow: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: COLORS.white,
  },
  cellNum: {
    width: 24,
    fontSize: 12,
    color: COLORS.gray,
    textAlign: "center",
  },
  cellProduct: {
    flex: 1.5,
    paddingRight: 4,
  },
  productName: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.black,
  },
  cellCategory: {
    flex: 1,
    paddingRight: 4,
  },
  categoryText: {
    fontSize: 12,
    color: COLORS.gray,
  },
  cellUnits: {
    flex: 0.5,
    alignItems: "center",
  },
  unitsBadge: {
    backgroundColor: "#00BCD4",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  unitsText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  cellPeriod: {
    flex: 0.8,
    alignItems: "center",
  },
  periodBadge: {
    backgroundColor: "#00BCD4",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  periodText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "600",
  },
  cellPrice: {
    flex: 0.8,
    textAlign: "right",
    fontWeight: "600",
    color: COLORS.black,
    fontSize: 13,
  },
  cellLateFee: {
    flex: 0.8,
    textAlign: "right",
    fontSize: 12,
    color: "#F44336",
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
    textAlign: "center",
    paddingHorizontal: 40,
  },
});

export default PricingScreen;
