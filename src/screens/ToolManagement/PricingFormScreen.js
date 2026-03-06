import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, RoundedContainer } from "@components/containers";
import NavigationHeader from "@components/Header/NavigationHeader";
import { TextInput } from "@components/common/TextInput";
import { Button } from "@components/common/Button";
import { COLORS, SPACING, BORDER_RADIUS } from "@constants/theme";
import { showToastMessage } from "@components/Toast";
import { updatePricingRule } from "@api/services/odooService";
import useAuthStore from "@stores/auth/useAuthStore";

const PERIOD_OPTIONS = [
  { label: "Per Day", value: "day" },
  { label: "Per Week", value: "week" },
  { label: "Per Month", value: "month" },
  { label: "Fixed Price", value: "fixed" },
];

const PricingFormScreen = ({ navigation, route }) => {
  const rule = route?.params?.rule;
  const odooAuth = useAuthStore((s) => s.odooAuth);

  const [form, setForm] = useState({
    period_type: rule?.period_type || "day",
    price: rule?.price?.toString() || "0",
    late_fee_per_day: rule?.late_fee_per_day?.toString() || "0",
    min_duration: rule?.min_duration?.toString() || "0",
    max_duration: rule?.max_duration?.toString() || "0",
    notes: rule?.notes || "",
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!rule?.odoo_id || !odooAuth) return;
    setSaving(true);
    try {
      await updatePricingRule(odooAuth, rule.odoo_id, {
        period_type: form.period_type,
        price: form.price,
        late_fee_per_day: form.late_fee_per_day,
        min_duration: form.min_duration,
        max_duration: form.max_duration,
        notes: form.notes,
      });
      showToastMessage("Pricing rule updated successfully");
      navigation.goBack();
    } catch (error) {
      showToastMessage("Error: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView>
      <NavigationHeader
        title={rule?.product_name || "Edit Pricing"}
        navigation={navigation}
      />
      <RoundedContainer>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Product Info (read-only) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PRODUCT INFO</Text>
            <View style={styles.card}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Product</Text>
                <Text style={styles.infoValue}>{rule?.product_name || "—"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tool</Text>
                <Text style={styles.infoValue}>{rule?.tool_name || "—"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Category</Text>
                <Text style={styles.infoValue}>{rule?.category_name || "—"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Serial Units</Text>
                <View style={styles.unitsBadge}>
                  <Text style={styles.unitsText}>{rule?.serial_count || 1}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Pricing */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PRICING</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.halfField}>
                  <TextInput
                    label="Rental Price"
                    placeholder="0.00"
                    value={form.price}
                    onChangeText={(t) => handleChange("price", t)}
                    keyboardType="decimal-pad"
                    column
                  />
                </View>
                <View style={styles.halfField}>
                  <TextInput
                    label="Late Fee / Day"
                    placeholder="0.00"
                    value={form.late_fee_per_day}
                    onChangeText={(t) => handleChange("late_fee_per_day", t)}
                    keyboardType="decimal-pad"
                    column
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>NOTES</Text>
            <View style={styles.card}>
              <TextInput
                label="Notes"
                placeholder="Any notes about this pricing rule..."
                value={form.notes}
                onChangeText={(t) => handleChange("notes", t)}
                multiline
                numberOfLines={3}
                column
              />
            </View>
          </View>

          {/* Save Button */}
          <View style={styles.buttonWrap}>
            {saving ? (
              <View style={styles.loadingBtn}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.loadingText}>Saving...</Text>
              </View>
            ) : (
              <Button title="Save Pricing Rule" onPress={handleSave} />
            )}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </RoundedContainer>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  scroll: { padding: SPACING.paddingMedium },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.gray,
    letterSpacing: 1,
    marginBottom: 8,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.medium,
    padding: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  infoLabel: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 13,
    color: COLORS.black,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  unitsBadge: {
    backgroundColor: "#00BCD4",
    borderRadius: 12,
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  unitsText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primaryThemeColor,
    marginBottom: 8,
  },
  periodRow: {
    marginBottom: 12,
  },
  periodChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  periodChipActive: {},
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.gray,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primaryThemeColor,
  },
  periodChipText: {
    fontSize: 14,
    color: "#555",
  },
  periodChipTextActive: {
    color: COLORS.primaryThemeColor,
    fontWeight: "600",
  },
  row: { flexDirection: "row", gap: 10 },
  halfField: { flex: 1 },
  buttonWrap: { marginTop: 8, paddingHorizontal: 4 },
  loadingBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryThemeColor,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.medium,
    gap: 8,
  },
  loadingText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 8,
  },
  cancelText: { color: COLORS.gray, fontSize: 15, fontWeight: "500" },
});

export default PricingFormScreen;
