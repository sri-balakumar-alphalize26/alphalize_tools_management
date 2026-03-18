import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput as RNTextInput,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView, RoundedContainer } from "@components/containers";
import NavigationHeader from "@components/Header/NavigationHeader";
import { TextInput } from "@components/common/TextInput";
import { Button } from "@components/common/Button";
import { COLORS, SPACING, BORDER_RADIUS } from "@constants/theme";
import { showToastMessage } from "@components/Toast";
import useToolStore from "@stores/toolManagement/useToolStore";
import useAuthStore from "@stores/auth/useAuthStore";
import { generateSerializedProducts } from "@api/services/odooService";

const ToolFormScreen = ({ navigation, route }) => {
  const mode = route?.params?.mode || "create";
  const existingTool = route?.params?.tool;
  const odooAuth = useAuthStore((s) => s.odooAuth);
  const updateToolStore = useToolStore((s) => s.updateTool);
  const categories = useToolStore((s) => s.categories);
  const fetchCategories = useToolStore((s) => s.fetchCategories);

  // Fetch categories on focus
  useFocusEffect(
    useCallback(() => {
      if (odooAuth) fetchCategories(odooAuth);
    }, [odooAuth])
  );

  const [form, setForm] = useState({
    name: existingTool?.name || "",
    code: existingTool?.code || "",
    serial_number: existingTool?.serial_number || "",
    barcode: existingTool?.barcode || "",
    brand: existingTool?.brand || "",
    model_name: existingTool?.model_name || "",
    location: existingTool?.location || "",
    total_qty: existingTool?.total_qty?.toString() || "1",
    rental_price_per_day: existingTool?.rental_price_per_day?.toString() || "",
    late_fee_per_day: existingTool?.late_fee_per_day?.toString() || "",
    purchase_price: existingTool?.purchase_price?.toString() || "",
    purchase_date: existingTool?.purchase_date || "",
    description: existingTool?.description || "",
    state: existingTool?.state || "available",
    category_id: existingTool?.category_id || "",
  });

  // Image state (base64 string)
  const [imageBase64, setImageBase64] = useState(existingTool?.image || null);

  // Serial numbers for bulk generation
  const [serialNumbersText, setSerialNumbersText] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const handlePickResult = (result) => {
    if (!result.canceled && result.assets?.[0]?.base64) {
      setImageBase64(result.assets[0].base64);
    }
  };

  const pickFromGallery = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const uri = result.assets[0].uri;
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        setImageBase64(base64);
      }
    } catch (e) {
      Alert.alert("Error", "Could not open file picker.");
    }
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera permission is required to take photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    handlePickResult(result);
  };

  const pickImage = () => {
    Alert.alert("Select Photo", "Choose an option", [
      { text: "Camera", onPress: pickFromCamera },
      { text: "Files", onPress: pickFromGallery },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const getSerialList = () => {
    if (!serialNumbersText.trim()) return [];
    return serialNumbersText.trim().split("\n").map((s) => s.trim()).filter(Boolean);
  };

  const serialList = getSerialList();

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Product name is required";
    if (mode === "create" && serialList.length === 0) e.serials = "Enter at least one serial number";
    // Check duplicates
    if (serialList.length !== new Set(serialList).size) e.serials = "Duplicate serial numbers found";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleGenerate = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (odooAuth) {
        if (mode === "edit" && existingTool?.odoo_id) {
          // Edit existing tool
          await updateToolStore(odooAuth, existingTool.odoo_id, { ...form, image: imageBase64 || false });
          showToastMessage("Tool updated successfully");
        } else {
          // Generate serialized products
          const created = await generateSerializedProducts(odooAuth, {
            productName: form.name,
            listPrice: form.rental_price_per_day,
            lateFeePerDay: form.late_fee_per_day,
            categoryId: form.category_id,
            serialNumbers: serialList,
            image: imageBase64 || null,
          });
          showToastMessage(`${created.length} product(s) created for "${form.name}"`);
        }
      }
      navigation.goBack();
    } catch (error) {
      showToastMessage("Error: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const isEditMode = mode === "edit";

  return (
    <SafeAreaView>
      <NavigationHeader
        title={isEditMode ? (form.name || "Edit Tool") : "Generate Serialized Products"}
        navigation={navigation}
      />
      <RoundedContainer>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Product Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PRODUCT DETAILS</Text>
            <View style={styles.card}>
              {/* Image Picker */}
              <TouchableOpacity style={styles.imagePickerWrap} onPress={pickImage} activeOpacity={0.7}>
                {imageBase64 ? (
                  <Image
                    source={{ uri: `data:image/png;base64,${imageBase64}` }}
                    style={styles.imagePreview}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Text style={styles.imagePlaceholderIcon}>+</Text>
                    <Text style={styles.imagePlaceholderText}>Add Photo</Text>
                  </View>
                )}
              </TouchableOpacity>
              {imageBase64 && (
                <TouchableOpacity onPress={pickImage} style={styles.changePhotoBtn}>
                  <Text style={styles.changePhotoText}>Change Photo</Text>
                </TouchableOpacity>
              )}

              <TextInput
                label="Product Name *"
                placeholder="e.g. Drill Machine"
                value={form.name}
                onChangeText={(t) => handleChange("name", t)}
                error={errors.name}
                column
              />
              <View style={styles.row}>
                <View style={styles.halfField}>
                  <TextInput
                    label="Rental Price / Day"
                    placeholder="0.00"
                    value={form.rental_price_per_day}
                    onChangeText={(t) => handleChange("rental_price_per_day", t)}
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

              {/* Rental Category from Odoo */}
              <Text style={styles.fieldLabel}>Rental Category</Text>
              <View style={styles.categoryChips}>
                {categories.length > 0 ? categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.chip,
                      form.category_id === cat.id && styles.chipActive,
                    ]}
                    onPress={() => handleChange("category_id", form.category_id === cat.id ? "" : cat.id)}
                  >
                    <Text style={[styles.chipText, form.category_id === cat.id && styles.chipTextActive]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                )) : (
                  <Text style={styles.noDataText}>No categories found in Odoo</Text>
                )}
              </View>

              {/* Extra fields for edit mode */}
              {isEditMode && (
                <>
                  <TextInput label="Internal Code" placeholder="e.g. PWR-001" value={form.code} onChangeText={(t) => handleChange("code", t)} column />
                  <TextInput label="Serial Number" placeholder="Serial number" value={form.serial_number} onChangeText={(t) => handleChange("serial_number", t)} column />
                  <TextInput label="Barcode" placeholder="Barcode" value={form.barcode} onChangeText={(t) => handleChange("barcode", t)} column />
                  <TextInput label="Brand" placeholder="Brand" value={form.brand} onChangeText={(t) => handleChange("brand", t)} column />
                  <TextInput label="Model" placeholder="Model" value={form.model_name} onChangeText={(t) => handleChange("model_name", t)} column />
                  <TextInput label="Location" placeholder="e.g. Warehouse A" value={form.location} onChangeText={(t) => handleChange("location", t)} column />
                  <TextInput label="Description" placeholder="Tool description..." value={form.description} onChangeText={(t) => handleChange("description", t)} multiline numberOfLines={3} column />
                </>
              )}
            </View>
          </View>

          {/* Serial Numbers (create mode only) */}
          {!isEditMode && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>SERIAL NUMBERS</Text>
              <View style={styles.card}>
                <Text style={styles.hint}>Enter one serial number per line</Text>
                <View style={styles.serialInputWrap}>
                  <RNTextInput
                    style={styles.serialInput}
                    placeholder={"DRL-001\nDRL-002\nDRL-003"}
                    placeholderTextColor="#bbb"
                    value={serialNumbersText}
                    onChangeText={setSerialNumbersText}
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                  />
                </View>
                {errors.serials && <Text style={styles.errorText}>{errors.serials}</Text>}

                {/* Preview */}
                {serialList.length > 0 && (
                  <View style={styles.preview}>
                    <Text style={styles.previewTitle}>
                      {serialList.length} product(s) will be created
                    </Text>
                    {serialList.slice(0, 10).map((s, i) => (
                      <View key={i} style={styles.previewRow}>
                        <View style={styles.previewBullet} />
                        <Text style={styles.previewText}>{form.name || "Product"} — {s}</Text>
                      </View>
                    ))}
                    {serialList.length > 10 && (
                      <Text style={styles.previewMore}>... and {serialList.length - 10} more</Text>
                    )}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Generate / Save Button */}
          <View style={styles.buttonWrap}>
            {saving ? (
              <View style={styles.loadingBtn}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.loadingText}>
                  {isEditMode ? "Saving..." : "Generating..."}
                </Text>
              </View>
            ) : (
              <Button
                title={isEditMode ? "Save Tool" : `Generate ${serialList.length > 0 ? serialList.length + " " : ""}Products`}
                onPress={handleGenerate}
              />
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
  imagePickerWrap: {
    alignSelf: "center",
    width: 120,
    height: 120,
    borderRadius: BORDER_RADIUS.medium,
    borderWidth: 1,
    borderColor: "#ddd",
    borderStyle: "dashed",
    backgroundColor: "#fafafa",
    overflow: "hidden",
    marginBottom: 10,
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderIcon: {
    fontSize: 28,
    color: COLORS.gray,
    fontWeight: "300",
  },
  imagePlaceholderText: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  changePhotoBtn: {
    alignSelf: "center",
    marginBottom: 12,
  },
  changePhotoText: {
    fontSize: 13,
    color: COLORS.primaryThemeColor,
    fontWeight: "600",
  },
  row: { flexDirection: "row", gap: 10 },
  halfField: { flex: 1 },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primaryThemeColor,
    marginTop: 10,
    marginBottom: 6,
  },
  categoryChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#f9f9f9",
  },
  chipActive: {
    backgroundColor: COLORS.primaryThemeColor,
    borderColor: COLORS.primaryThemeColor,
  },
  chipText: { fontSize: 13, color: COLORS.gray },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  noDataText: { fontSize: 13, color: COLORS.gray, fontStyle: "italic" },
  hint: { fontSize: 12, color: COLORS.gray, marginBottom: 8 },
  serialInputWrap: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: BORDER_RADIUS.medium,
    backgroundColor: "#fafafa",
    minHeight: 120,
  },
  serialInput: {
    padding: 12,
    fontSize: 14,
    color: "#333",
    fontFamily: "monospace",
    minHeight: 120,
  },
  errorText: { color: "#F44336", fontSize: 12, marginTop: 4 },
  preview: {
    marginTop: 12,
    padding: 10,
    backgroundColor: "#F1F8E9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C5E1A5",
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#33691E",
    marginBottom: 6,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },
  previewBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#689F38",
    marginRight: 8,
  },
  previewText: { fontSize: 12, color: "#33691E" },
  previewMore: { fontSize: 12, color: "#689F38", fontStyle: "italic", marginTop: 4 },
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

export default ToolFormScreen;
