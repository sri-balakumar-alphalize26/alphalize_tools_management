import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Switch,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { SafeAreaView, RoundedContainer } from "@components/containers";
import NavigationHeader from "@components/Header/NavigationHeader";
import showAlert from "@components/Modal/alertHost";
import { showToastMessage } from "@components/Toast";
import { COLORS, FONT_FAMILY } from "@constants/theme";
import {
  fetchBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
} from "@api/services/bannerApi";

const BannerDetailsScreen = ({ navigation, route }) => {
  const mode = route?.params?.mode === "edit" ? "edit" : "create";
  const seedBanner = route?.params?.banner || null;
  const bannerId = seedBanner?.id || null;

  const [form, setForm] = useState({
    name: seedBanner?.name || "",
    active: seedBanner?.active !== false,
    image: seedBanner?.image || null,
    image_filename: seedBanner?.image_filename || "",
    imageDirty: false,
  });
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    console.log("[BANNER] details mount", { mode, bannerId });
  }, [mode, bannerId]);

  // In edit mode, pull the full record from Odoo so the image bytes are
  // current (the row passed via nav params may have a stale image).
  useFocusEffect(
    useCallback(() => {
      if (mode !== "edit" || !bannerId) return;
      (async () => {
        const row = await fetchBannerById(bannerId);
        if (row) {
          setForm((prev) => ({
            ...prev,
            name: row.name || prev.name,
            active: row.active !== false,
            image: row.image || prev.image,
            image_filename: row.image_filename || "",
            imageDirty: false,
          }));
        }
      })();
    }, [mode, bannerId])
  );

  const setField = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const pickFromGallery = async () => {
    console.log("[BANNER] picker open");
    setPicking(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showToastMessage("Photo library permission denied");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: true,
        aspect: [3, 1],
        exif: false,
      });
      if (res.canceled) {
        console.log("[BANNER] picker canceled");
        return;
      }
      const asset = res.assets?.[0];
      if (!asset?.uri) return;
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log("[BANNER] picker picked", {
        filename: asset.fileName,
        bytes: base64.length,
      });
      setForm((prev) => ({
        ...prev,
        image: base64,
        image_filename: asset.fileName || "banner.jpg",
        imageDirty: true,
      }));
    } catch (e) {
      console.warn("[BANNER] picker error", e?.message || e);
      showToastMessage(`Image pick failed: ${e?.message || e}`);
    } finally {
      setPicking(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToastMessage("Name is required");
      return;
    }
    if (mode === "create" && !form.image) {
      showToastMessage("Image is required");
      return;
    }
    console.log("[BANNER] save begin", { mode, imageDirty: form.imageDirty });
    setSaving(true);
    try {
      let res;
      if (mode === "create") {
        res = await createBanner({
          name: form.name.trim(),
          image: form.image,
          image_filename: form.image_filename || "banner.jpg",
          sequence: 10,
          active: form.active,
        });
      } else {
        const payload = {
          id: bannerId,
          name: form.name.trim(),
          sequence: 10,
          active: form.active,
        };
        if (form.imageDirty && form.image) {
          payload.image = form.image;
          payload.image_filename = form.image_filename || "banner.jpg";
        }
        res = await updateBanner(payload);
      }
      if (res?.error) {
        console.warn("[BANNER] save error", res.error);
        showToastMessage(res.error);
        return;
      }
      console.log("[BANNER] save ok", res);
      showToastMessage(mode === "create" ? "Banner created" : "Banner updated");
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    showAlert(
      "Delete banner?",
      "This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            console.log("[BANNER] delete begin", { id: bannerId });
            setDeleting(true);
            try {
              const res = await deleteBanner(bannerId);
              if (res?.error) {
                console.warn("[BANNER] delete error", res.error);
                showToastMessage(res.error);
                return;
              }
              console.log("[BANNER] delete ok");
              showToastMessage("Banner deleted");
              navigation.goBack();
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const isBusy = saving || deleting || picking;
  const saveLabel = saving ? "Saving…" : "Save";

  return (
    <SafeAreaView backgroundColor={COLORS.primaryThemeColor}>
      <NavigationHeader
        title={mode === "edit" ? "Edit Banner" : "Create Banner"}
        navigation={navigation}
        rightComponent={
          <TouchableOpacity
            onPress={handleSave}
            disabled={isBusy}
            style={[styles.saveBtn, isBusy && { opacity: 0.5 }]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>{saveLabel}</Text>
            )}
          </TouchableOpacity>
        }
      />
      <RoundedContainer>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.card}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(t) => setField("name", t)}
              placeholder="e.g. Summer Sale"
              placeholderTextColor="#aaa"
            />

            <View style={styles.switchRow}>
              <Text style={styles.label}>Active</Text>
              <Switch
                value={form.active}
                onValueChange={(v) => setField("active", v)}
                trackColor={{ false: "#D0D0D0", true: COLORS.primaryThemeColor }}
                thumbColor={form.active ? "#fff" : "#f4f3f4"}
              />
            </View>

            <Text style={[styles.label, { marginTop: 14 }]}>Image (3:1)</Text>
            {form.image ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${form.image}` }}
                style={styles.preview}
                resizeMode="cover"
                resizeMethod="resize"
              />
            ) : (
              <View style={[styles.preview, styles.previewEmpty]}>
                <MaterialIcons name="image" size={48} color="#cfcfd9" />
                <Text style={styles.previewEmptyText}>No image yet</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.pickBtn}
              activeOpacity={0.85}
              onPress={pickFromGallery}
              disabled={isBusy}
            >
              <MaterialIcons
                name={mode === "edit" && form.image ? "cached" : "photo-library"}
                size={20}
                color="#fff"
              />
              <Text style={styles.pickBtnText}>
                {picking
                  ? "Loading…"
                  : mode === "edit" && form.image
                  ? "Replace image"
                  : "Pick from gallery"}
              </Text>
            </TouchableOpacity>

            {mode === "edit" ? (
              <TouchableOpacity
                style={styles.deleteBtn}
                activeOpacity={0.85}
                onPress={handleDelete}
                disabled={isBusy}
              >
                <MaterialIcons name="delete-outline" size={20} color="#E53935" />
                <Text style={styles.deleteBtnText}>
                  {deleting ? "Deleting…" : "Delete banner"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
      </RoundedContainer>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    padding: 14,
    paddingBottom: 60,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#1a1a2e",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  label: {
    fontSize: 12,
    fontFamily: FONT_FAMILY.urbanistBold,
    color: "#666",
    marginBottom: 4,
  },
  input: {
    fontSize: 14,
    fontFamily: FONT_FAMILY.urbanistSemiBold,
    color: COLORS.black,
    borderBottomWidth: 1,
    borderBottomColor: "#D0D0D0",
    paddingVertical: 8,
    marginBottom: 14,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  preview: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 10,
    backgroundColor: "#F1F2F6",
    marginBottom: 12,
  },
  previewEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  previewEmptyText: {
    fontSize: 12,
    fontFamily: FONT_FAMILY.urbanistMedium,
    color: "#9CA3AF",
    marginTop: 6,
  },
  pickBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryThemeColor,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  pickBtnText: {
    color: "#fff",
    marginLeft: 8,
    fontSize: 14,
    fontFamily: FONT_FAMILY.urbanistBold,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1.2,
    borderColor: "#E53935",
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  deleteBtnText: {
    color: "#E53935",
    marginLeft: 8,
    fontSize: 14,
    fontFamily: FONT_FAMILY.urbanistBold,
  },
  saveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: FONT_FAMILY.urbanistBold,
  },
});

export default BannerDetailsScreen;
