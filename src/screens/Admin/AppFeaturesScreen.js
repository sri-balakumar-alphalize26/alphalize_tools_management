// In-app admin to hide React-Native UI elements per Odoo user. Reads/writes
// the same `app.feature.visibility.rental` rows the Odoo backend manages, so a
// change made here is identical to one an Odoo admin would make in the
// tool_rental_privilege_manager dashboard.
//
// Ported from the Grocery app's AppFeaturesScreen, rewired to this app's
// conventions: execute_kw via privilegeApi, @expo/vector-icons, built-in Modal,
// showToastMessage, Alert confirmations, and the Urbanist theme fonts.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Switch,
  FlatList,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Text from "@components/Text";
import NavigationHeader from "@components/Header/NavigationHeader";
import { SafeAreaView, RoundedContainer } from "@components/containers";
import { showToastMessage } from "@components/Toast";
import { useAuthStore } from "@stores/auth";
import { COLORS, FONT_FAMILY } from "@constants/theme";
import {
  fetchAppFeatures,
  fetchUsers,
  fetchHiddenFeaturesForUserAdmin,
  fetchPrivilegeStats,
  toggleFeatureHidden,
  hideAllFeatures,
  clearAllHides,
  ZERO_STATS,
} from "@api/services/privilegeApi";

const NAVY = COLORS.primaryThemeColor;
const MUTED = "#8896ab";

const VISIBLE_ACCENT = "#16a34a";
const VISIBLE_BG = "#dcfce7";
const HIDDEN_ACCENT = "#dc2626";
const HIDDEN_BG = "#fee2e2";

// Turn a feature_key into a (groupKey, groupLabel) pair. Group key = the
// dotted prefix minus the last segment; label = title-cased segments.
const groupOf = (feature) => {
  const key = feature.feature_key || "";
  const parts = key.split(".").filter(Boolean);
  if (parts.length <= 1) {
    return { groupKey: "_misc", groupLabel: "Other" };
  }
  const groupKey = parts.slice(0, -1).join(".");
  const groupLabel =
    groupKey
      .split(".")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ") + (parts.length > 2 ? "s" : "");
  return { groupKey, groupLabel };
};

const AppFeaturesScreen = ({ navigation }) => {
  const auth = useAuthStore((s) => s.odooAuth);
  const authUser = useAuthStore((s) => s.user);

  const [isAdmin, setIsAdmin] = useState(false);
  const [features, setFeatures] = useState([]);
  const [loadingFeatures, setLoadingFeatures] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [stats, setStats] = useState(ZERO_STATS);
  const [loadingHidden, setLoadingHidden] = useState(false);

  const [originalHiddenIds, setOriginalHiddenIds] = useState(new Set());
  const [saving, setSaving] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchText, setSearchText] = useState("");

  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [expandedParents, setExpandedParents] = useState(new Set());

  // ── Admin guard ───────────────────────────────────────────────────
  useEffect(() => {
    const ok = authUser?.uid === 2 || authUser?.is_admin === true || authUser?.is_superuser === true;
    setIsAdmin(ok);
    if (!ok) {
      showToastMessage("Only administrators can access this feature");
      const t = setTimeout(() => navigation.goBack(), 1500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [authUser, navigation]);

  // ── Load the feature catalog ──────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoadingFeatures(true);
      const rows = await fetchAppFeatures(auth);
      setFeatures(rows);
      setLoadingFeatures(false);
    })();
  }, [isAdmin, auth]);

  // ── Per-user data (hides + stats) ─────────────────────────────────
  const loadUserData = useCallback(
    async (uid) => {
      setLoadingHidden(true);
      try {
        const [hideRows, statsResult] = await Promise.all([
          fetchHiddenFeaturesForUserAdmin(auth, uid),
          fetchPrivilegeStats(auth, uid),
        ]);
        const ids = new Set(
          hideRows.map((r) => (Array.isArray(r.feature_id) ? r.feature_id[0] : r.feature_id)),
        );
        setHiddenIds(ids);
        setOriginalHiddenIds(new Set(ids));
        setStats(statsResult);
      } finally {
        setLoadingHidden(false);
      }
    },
    [auth],
  );

  useEffect(() => {
    if (!selectedUser) {
      setHiddenIds(new Set());
      setOriginalHiddenIds(new Set());
      setStats(ZERO_STATS);
      return;
    }
    loadUserData(selectedUser.id);
  }, [selectedUser, loadUserData]);

  // ── Buffered-changes derivation ───────────────────────────────────
  const pendingFeatureIds = useMemo(() => {
    const pending = new Set();
    const union = new Set([...originalHiddenIds, ...hiddenIds]);
    for (const id of union) {
      if (originalHiddenIds.has(id) !== hiddenIds.has(id)) pending.add(id);
    }
    return pending;
  }, [hiddenIds, originalHiddenIds]);
  const pendingCount = pendingFeatureIds.size;

  // ── User picker (debounced search) ────────────────────────────────
  const loadUsers = useCallback(
    async (text) => {
      setLoadingUsers(true);
      try {
        const rows = await fetchUsers(auth, text || "");
        setUsers(rows);
      } finally {
        setLoadingUsers(false);
      }
    },
    [auth],
  );

  useEffect(() => {
    if (!pickerOpen) return undefined;
    const t = setTimeout(() => loadUsers(searchText), 350);
    return () => clearTimeout(t);
  }, [pickerOpen, searchText, loadUsers]);

  const handlePickUser = (u) => {
    setSelectedUser({ id: u.id, name: u.name, login: u.login, _isAdmin: u._isAdmin });
    setSearchText("");
    setPickerOpen(false);
  };

  // ── Buffered toggle (no RPC until Save) ───────────────────────────
  const handleToggle = useCallback(
    (feature, nextHidden) => {
      if (!selectedUser) return;
      const fid = feature.id;
      setHiddenIds((prev) => {
        const next = new Set(prev);
        if (nextHidden) next.add(fid);
        else next.delete(fid);
        return next;
      });
    },
    [selectedUser],
  );

  // ── Save ──────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!selectedUser || pendingCount === 0 || saving) return;
    setSaving(true);
    const tasks = [];
    for (const fid of pendingFeatureIds) {
      tasks.push(toggleFeatureHidden(auth, selectedUser.id, fid, hiddenIds.has(fid)));
    }
    try {
      const results = await Promise.allSettled(tasks);
      const failed = results.filter((r) => r.status === "rejected");
      showToastMessage(
        failed.length > 0
          ? `${failed.length} of ${results.length} changes failed. Try again.`
          : "Privileges saved",
      );
      await loadUserData(selectedUser.id);
    } finally {
      setSaving(false);
    }
  }, [selectedUser, pendingCount, pendingFeatureIds, hiddenIds, saving, loadUserData, auth]);

  const handleDiscard = useCallback(() => {
    if (pendingCount === 0) return;
    Alert.alert(
      "Discard unsaved changes?",
      `You have ${pendingCount} feature${pendingCount === 1 ? "" : "s"} with unsaved visibility changes.`,
      [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            if (selectedUser) loadUserData(selectedUser.id);
          },
        },
      ],
    );
  }, [pendingCount, selectedUser, loadUserData]);

  // ── Bulk: Hide all ────────────────────────────────────────────────
  const handleHideAll = useCallback(() => {
    if (!selectedUser || saving) return;
    Alert.alert(
      "Hide every feature?",
      `Mark every defined feature as hidden for ${selectedUser.name}. On their next login every gated UI element disappears.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Hide all",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            try {
              const total = await hideAllFeatures(auth, selectedUser.id);
              await loadUserData(selectedUser.id);
              showToastMessage(`${total} feature${total === 1 ? "" : "s"} hidden for ${selectedUser.name}`);
            } catch (err) {
              showToastMessage(err?.message || "Could not hide all features");
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  }, [selectedUser, saving, loadUserData, auth]);

  // ── Bulk: Reset all ───────────────────────────────────────────────
  const handleResetAll = useCallback(() => {
    if (!selectedUser || saving) return;
    Alert.alert(
      "Reset all hides?",
      `Clear every hide for ${selectedUser.name}. Their next login will show every gated UI element again.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset all",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            try {
              const removed = await clearAllHides(auth, selectedUser.id);
              await loadUserData(selectedUser.id);
              showToastMessage(
                removed > 0
                  ? `${removed} hide${removed === 1 ? "" : "s"} removed for ${selectedUser.name}`
                  : `${selectedUser.name} already had no hides`,
              );
            } catch (err) {
              showToastMessage(err?.message || "Could not clear hides");
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  }, [selectedUser, saving, loadUserData, auth]);

  // ── Warn on Back when there are pending changes ───────────────────
  useEffect(() => {
    if (pendingCount === 0) return undefined;
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (saving) return;
      e.preventDefault();
      Alert.alert(
        "Discard unsaved changes?",
        `You have ${pendingCount} feature${pendingCount === 1 ? "" : "s"} with unsaved visibility changes.`,
        [
          { text: "Keep editing", style: "cancel" },
          { text: "Discard & leave", style: "destructive", onPress: () => navigation.dispatch(e.data.action) },
        ],
      );
    });
    return unsubscribe;
  }, [navigation, pendingCount, saving]);

  // ── Build grouped flat list ───────────────────────────────────────
  const flatList = useMemo(() => {
    if (!features || features.length === 0) return [];
    const parentIdOf = (f) => (Array.isArray(f.parent_id) ? f.parent_id[0] : f.parent_id) || null;
    const childrenOf = new Map();
    for (const f of features) {
      const pid = parentIdOf(f);
      if (pid) {
        if (!childrenOf.has(pid)) childrenOf.set(pid, []);
        childrenOf.get(pid).push(f);
      }
    }
    const topLevel = features.filter((f) => !parentIdOf(f));
    const buckets = new Map();
    for (const f of topLevel) {
      const { groupKey, groupLabel } = groupOf(f);
      if (!buckets.has(groupKey)) buckets.set(groupKey, { groupKey, groupLabel, items: [] });
      buckets.get(groupKey).items.push(f);
    }
    const ordered = Array.from(buckets.values()).sort((a, b) => a.groupLabel.localeCompare(b.groupLabel));
    const out = [];
    for (const b of ordered) {
      const hiddenCount = b.items.filter((it) => hiddenIds.has(it.id)).length;
      out.push({ kind: "header", groupKey: b.groupKey, groupLabel: b.groupLabel, total: b.items.length, hiddenCount });
      if (collapsedGroups.has(b.groupKey)) continue;
      for (const it of b.items) {
        const kids = childrenOf.get(it.id) || [];
        out.push({ kind: "feature", ...it, _hasChildren: kids.length > 0, _childCount: kids.length });
        if (kids.length > 0 && expandedParents.has(it.id)) {
          for (const c of kids) out.push({ kind: "feature", ...c, _isChild: true });
        }
      }
    }
    return out;
  }, [features, hiddenIds, collapsedGroups, expandedParents]);

  const toggleGroupCollapse = (groupKey) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });

  const toggleParentExpand = (parentId) =>
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });

  const initialOf = (name) => (name || "?").trim().charAt(0).toUpperCase() || "?";

  // ── Renderers ─────────────────────────────────────────────────────
  const renderFlatRow = ({ item }) => {
    if (item.kind === "header") {
      const collapsed = collapsedGroups.has(item.groupKey);
      return (
        <TouchableOpacity style={styles.groupHeader} activeOpacity={0.7} onPress={() => toggleGroupCollapse(item.groupKey)}>
          <MaterialIcons name={collapsed ? "chevron-right" : "expand-more"} size={20} color="#475569" />
          <MaterialIcons name="folder" size={16} color={NAVY} style={{ marginRight: 6, marginLeft: 2 }} />
          <Text style={styles.groupHeaderLabel}>{item.groupLabel}</Text>
          <View style={styles.groupBadge}>
            <Text style={styles.groupBadgeText}>
              {item.hiddenCount > 0 ? `${item.hiddenCount} hidden · ${item.total}` : `${item.total}`}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }
    const feature = item;
    const isHidden = hiddenIds.has(feature.id);
    const isDirty = pendingFeatureIds.has(feature.id);
    const accent = isHidden ? HIDDEN_ACCENT : VISIBLE_ACCENT;
    const borderColor = isDirty ? "#f59e0b" : accent;
    const pillBg = isHidden ? HIDDEN_BG : VISIBLE_BG;
    const subline = [feature.feature_key, feature.description].filter(Boolean).join("  ·  ");
    const isExpanded = expandedParents.has(feature.id);
    return (
      <View
        style={[
          styles.featureCard,
          { borderLeftColor: borderColor },
          isDirty && styles.featureCardDirty,
          feature._isChild && styles.featureCardChild,
        ]}
      >
        {feature._hasChildren ? (
          <TouchableOpacity
            onPress={() => toggleParentExpand(feature.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.expandChevron}
          >
            <MaterialIcons name={isExpanded ? "expand-more" : "chevron-right"} size={22} color={NAVY} />
          </TouchableOpacity>
        ) : null}
        <View style={styles.featureCardLeft}>
          <View style={[styles.statusDot, { backgroundColor: accent }]} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.featureName} numberOfLines={1}>
                {feature.name}
              </Text>
              {feature._hasChildren ? (
                <View style={styles.subCountPill}>
                  <Text style={styles.subCountPillText}>{feature._childCount} options</Text>
                </View>
              ) : null}
              {isDirty ? <View style={styles.dirtyDot} /> : null}
            </View>
            {subline ? (
              <Text style={styles.featureSubline} numberOfLines={2}>
                {subline}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.featureCardRight}>
          <View style={[styles.statusPill, { backgroundColor: pillBg }]}>
            <Text style={[styles.statusPillText, { color: accent }]}>{isHidden ? "Hidden" : "Visible"}</Text>
          </View>
          <Switch
            value={isHidden}
            disabled={saving}
            onValueChange={(v) => handleToggle(feature, v)}
            trackColor={{ false: "#cbd5e1", true: "#fca5a5" }}
            thumbColor={isHidden ? HIDDEN_ACCENT : "#f8fafc"}
          />
        </View>
      </View>
    );
  };

  const renderUserRow = ({ item }) => (
    <TouchableOpacity style={styles.userRow} onPress={() => handlePickUser(item)} activeOpacity={0.7}>
      <View style={[styles.userAvatar, { backgroundColor: item._isAdmin ? "#fde68a" : "#bfdbfe" }]}>
        <Text style={styles.userAvatarText}>{initialOf(item.name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.userName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.userLogin} numberOfLines={1}>
          {item.login}
        </Text>
      </View>
      {item._isAdmin ? (
        <View style={styles.adminBadge}>
          <Text style={styles.adminBadgeText}>ADMIN</Text>
        </View>
      ) : null}
      <MaterialIcons name="chevron-right" size={22} color={MUTED} />
    </TouchableOpacity>
  );

  const saveButton =
    pendingCount > 0 ? (
      <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn} activeOpacity={0.8}>
        <Text style={styles.saveBtnText}>{saving ? "Saving…" : `Save (${pendingCount})`}</Text>
      </TouchableOpacity>
    ) : null;

  return (
    <SafeAreaView backgroundColor={NAVY}>
      <NavigationHeader title="Apps Privileges" navigation={navigation} rightComponent={saveButton} />

      {pendingCount > 0 ? (
        <TouchableOpacity style={styles.pendingBar} onPress={handleDiscard} activeOpacity={0.8} disabled={saving}>
          <MaterialIcons name="info-outline" size={16} color="#92400e" />
          <Text style={styles.pendingBarText}>
            {pendingCount} feature{pendingCount === 1 ? "" : "s"} with unsaved changes
          </Text>
          <Text style={styles.pendingBarDiscard}>Discard</Text>
        </TouchableOpacity>
      ) : null}

      <RoundedContainer>
        {/* Selected-user card / picker entry */}
        {selectedUser ? (
          <View style={styles.selectedUserCard}>
            <View
              style={[
                styles.userAvatar,
                styles.userAvatarLg,
                { backgroundColor: selectedUser._isAdmin ? "#fde68a" : "#bfdbfe" },
              ]}
            >
              <Text style={styles.userAvatarTextLg}>{initialOf(selectedUser.name)}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.selectedUserName} numberOfLines={1}>
                {selectedUser.name}
              </Text>
              <Text style={styles.selectedUserLogin} numberOfLines={1}>
                {selectedUser.login}
              </Text>
            </View>
            <TouchableOpacity style={styles.changeBtn} onPress={() => setPickerOpen(true)} activeOpacity={0.7}>
              <MaterialIcons name="swap-horiz" size={16} color={NAVY} />
              <Text style={styles.changeBtnText}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.userPickerEmpty} activeOpacity={0.7} onPress={() => setPickerOpen(true)}>
            <View style={styles.userPickerEmptyIcon}>
              <MaterialIcons name="person-search" size={26} color={NAVY} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.pickerEmptyTitle}>Pick a user</Text>
              <Text style={styles.pickerEmptySub}>Choose whose visibility you want to manage</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={MUTED} />
          </TouchableOpacity>
        )}

        {/* Admin warning */}
        {selectedUser?._isAdmin ? (
          <View style={styles.adminWarnBanner}>
            <View style={styles.adminWarnIconWrap}>
              <MaterialIcons name="warning" size={22} color="#dc2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.adminWarnTitle}>This user is an administrator — privilege rules will NOT apply</Text>
              <Text style={styles.adminWarnBody}>
                Odoo bypasses all access-control checks for administrators, so toggles below will have no effect for{" "}
                {selectedUser.name}.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Stat tile */}
        {selectedUser ? (
          <View style={styles.statsRow}>
            <View style={[styles.statBannerSingle, { borderColor: "#9333ea" }]}>
              <View style={[styles.statBannerIconWrap, { backgroundColor: "#9333ea22" }]}>
                <MaterialIcons name="visibility-off" size={20} color="#9333ea" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.statBannerLabel, { color: "#9333ea" }]}>APP HIDDEN FEATURE</Text>
                <Text style={styles.statBannerSub}>Hidden for this user</Text>
              </View>
              <Text style={[styles.statBannerNumber, { color: "#9333ea" }]}>{stats.hidden_features ?? 0}</Text>
            </View>
          </View>
        ) : null}

        {selectedUser ? <Text style={styles.hint}>Visibility changes apply on the user's next login.</Text> : null}

        {/* Bulk actions */}
        {selectedUser ? (
          <View style={styles.bulkActionRow}>
            <TouchableOpacity
              style={[styles.bulkActionBtn, styles.bulkActionBtnDangerFilled, saving && { opacity: 0.6 }]}
              onPress={handleHideAll}
              disabled={saving}
              activeOpacity={0.85}
            >
              <MaterialIcons name="visibility-off" size={16} color="#fff" />
              <Text style={styles.bulkActionBtnTextPrimary}>Hide All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkActionBtn, styles.bulkActionBtnDanger, saving && { opacity: 0.6 }]}
              onPress={handleResetAll}
              disabled={saving}
              activeOpacity={0.85}
            >
              <MaterialIcons name="restart-alt" size={16} color="#dc2626" />
              <Text style={styles.bulkActionBtnTextDanger}>Reset All</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Feature list / empty states */}
        {!selectedUser ? (
          <View style={styles.bigEmpty}>
            <MaterialIcons name="visibility-off" size={48} color="#cbd5e1" />
            <Text style={styles.bigEmptyTitle}>No user selected</Text>
            <Text style={styles.bigEmptySub}>Pick a user above to see the list of features you can hide for them.</Text>
          </View>
        ) : (
          <FlatList
            data={flatList}
            keyExtractor={(it) => (it.kind === "header" ? `h-${it.groupKey}` : `f-${it.id}`)}
            renderItem={renderFlatRow}
            ListEmptyComponent={
              loadingFeatures ? (
                <View style={styles.bigEmpty}>
                  <ActivityIndicator color={NAVY} />
                </View>
              ) : (
                <View style={styles.bigEmpty}>
                  <MaterialIcons name="inbox" size={42} color="#cbd5e1" />
                  <Text style={styles.bigEmptyTitle}>No features defined yet</Text>
                  <Text style={styles.bigEmptySub}>Create one in Odoo: Privilege Manager → Apps Privileges.</Text>
                </View>
              )
            }
            refreshControl={
              <RefreshControl
                refreshing={loadingHidden}
                onRefresh={() => loadUserData(selectedUser.id)}
                tintColor={NAVY}
                colors={[NAVY]}
              />
            }
            contentContainerStyle={{ paddingBottom: 32, paddingTop: 4 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </RoundedContainer>

      {/* User picker popup */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.userPickerCard} onPress={() => {}}>
            <View style={styles.pickerHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <MaterialIcons name="person-search" size={20} color={NAVY} />
                <Text style={styles.pickerTitle}>Select User</Text>
              </View>
              <TouchableOpacity onPress={() => setPickerOpen(false)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <MaterialIcons name="close" size={22} color="#1a1a2e" />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerSearchWrap}>
              <View style={styles.pickerSearchBar}>
                <MaterialIcons name="search" size={18} color={MUTED} />
                <TextInput
                  style={styles.pickerSearchInput}
                  placeholder="Search by name or login"
                  placeholderTextColor={MUTED}
                  value={searchText}
                  onChangeText={setSearchText}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>
            </View>

            {loadingUsers ? (
              <View style={styles.pickerLoading}>
                <ActivityIndicator color={NAVY} />
                <Text style={styles.pickerLoadingText}>Loading users…</Text>
              </View>
            ) : (
              <FlatList
                data={users}
                keyExtractor={(u) => `user-${u.id}`}
                renderItem={renderUserRow}
                ListEmptyComponent={
                  <View style={{ padding: 24 }}>
                    <Text style={{ color: MUTED, textAlign: "center" }}>No users matched.</Text>
                  </View>
                }
                contentContainerStyle={{ paddingBottom: 12 }}
                showsVerticalScrollIndicator={false}
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  saveBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  saveBtnText: { color: NAVY, fontSize: 13, fontFamily: FONT_FAMILY.urbanistSemiBold },

  selectedUserCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
    marginHorizontal: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  selectedUserName: { fontSize: 15, color: "#0f172a", fontFamily: FONT_FAMILY.urbanistSemiBold },
  selectedUserLogin: { fontSize: 12, color: MUTED, marginTop: 2, fontFamily: FONT_FAMILY.urbanistRegular },
  changeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#eef2ff",
    borderRadius: 8,
    gap: 4,
  },
  changeBtnText: { fontSize: 12, color: NAVY, fontFamily: FONT_FAMILY.urbanistSemiBold },

  userPickerEmpty: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
    marginHorizontal: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderStyle: "dashed",
  },
  userPickerEmptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef2ff",
  },
  pickerEmptyTitle: { fontSize: 15, color: "#0f172a", fontFamily: FONT_FAMILY.urbanistSemiBold },
  pickerEmptySub: { fontSize: 12, color: MUTED, marginTop: 2, fontFamily: FONT_FAMILY.urbanistRegular },

  adminWarnBanner: {
    flexDirection: "row",
    backgroundColor: "#fef2f2",
    borderColor: "#fca5a5",
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 12,
    marginTop: 10,
    gap: 10,
  },
  adminWarnIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
  },
  adminWarnTitle: { fontSize: 13, color: "#b91c1c", fontFamily: FONT_FAMILY.urbanistSemiBold, marginBottom: 4 },
  adminWarnBody: { fontSize: 12, color: "#991b1b", fontFamily: FONT_FAMILY.urbanistRegular, lineHeight: 17, marginTop: 2 },

  statsRow: { flexDirection: "row", marginHorizontal: 12, marginTop: 10, gap: 8 },
  statBannerSingle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  statBannerIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  statBannerLabel: { fontSize: 11, fontFamily: FONT_FAMILY.urbanistSemiBold, letterSpacing: 0.4 },
  statBannerSub: { fontSize: 11, color: MUTED, marginTop: 2, fontFamily: FONT_FAMILY.urbanistRegular },
  statBannerNumber: { fontSize: 28, fontFamily: FONT_FAMILY.urbanistBold, marginLeft: 8 },

  bulkActionRow: { flexDirection: "row", marginHorizontal: 12, marginTop: 10, marginBottom: 4, gap: 8 },
  bulkActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
  },
  bulkActionBtnDangerFilled: { backgroundColor: "#dc2626", borderColor: "#b91c1c" },
  bulkActionBtnTextPrimary: { color: "#fff", fontSize: 13, fontFamily: FONT_FAMILY.urbanistSemiBold, letterSpacing: 0.2 },
  bulkActionBtnDanger: { backgroundColor: "#fee2e2", borderColor: "#fca5a5" },
  bulkActionBtnTextDanger: { color: "#dc2626", fontSize: 13, fontFamily: FONT_FAMILY.urbanistSemiBold, letterSpacing: 0.2 },

  hint: { fontSize: 11, color: MUTED, fontFamily: FONT_FAMILY.urbanistRegular, marginHorizontal: 16, marginTop: 8, marginBottom: 6 },

  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 10,
  },
  groupHeaderLabel: { fontSize: 13, color: "#0f172a", fontFamily: FONT_FAMILY.urbanistSemiBold, flex: 1, letterSpacing: 0.2 },
  groupBadge: {
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  groupBadgeText: { fontSize: 10, color: "#475569", fontFamily: FONT_FAMILY.urbanistSemiBold },

  pendingBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#fde68a",
    gap: 8,
  },
  pendingBarText: { flex: 1, fontSize: 12, color: "#92400e", fontFamily: FONT_FAMILY.urbanistSemiBold },
  pendingBarDiscard: { fontSize: 12, color: "#b91c1c", fontFamily: FONT_FAMILY.urbanistSemiBold, textDecorationLine: "underline" },

  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
    marginHorizontal: 12,
    marginVertical: 5,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  featureCardDirty: { backgroundColor: "#fffbeb" },
  featureCardChild: { marginLeft: 28 },
  expandChevron: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  subCountPill: {
    backgroundColor: "#eef2ff",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  subCountPillText: { fontSize: 10, color: NAVY, fontFamily: FONT_FAMILY.urbanistSemiBold, letterSpacing: 0.2 },
  dirtyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#f59e0b" },
  featureCardLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  featureCardRight: { alignItems: "center", marginLeft: 12, gap: 6 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  featureName: { fontSize: 15, color: "#0f172a", fontFamily: FONT_FAMILY.urbanistSemiBold },
  featureSubline: { fontSize: 11, color: MUTED, marginTop: 3, fontFamily: FONT_FAMILY.urbanistRegular },
  statusPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  statusPillText: { fontSize: 10, fontFamily: FONT_FAMILY.urbanistSemiBold, letterSpacing: 0.3 },

  bigEmpty: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingVertical: 48 },
  bigEmptyTitle: { fontSize: 15, color: "#475569", marginTop: 12, fontFamily: FONT_FAMILY.urbanistSemiBold },
  bigEmptySub: { fontSize: 12, color: MUTED, marginTop: 6, textAlign: "center", fontFamily: FONT_FAMILY.urbanistRegular },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  userPickerCard: {
    width: "90%",
    maxWidth: 440,
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  pickerTitle: { fontSize: 16, fontFamily: FONT_FAMILY.urbanistSemiBold, color: "#0f172a", marginLeft: 8 },
  pickerSearchWrap: { paddingHorizontal: 12, paddingVertical: 10 },
  pickerSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  pickerSearchInput: { flex: 1, padding: 0, fontFamily: FONT_FAMILY.urbanistRegular, fontSize: 14, color: "#0f172a" },
  pickerLoading: { alignItems: "center", padding: 24, gap: 8 },
  pickerLoadingText: { fontSize: 12, color: MUTED, fontFamily: FONT_FAMILY.urbanistRegular },

  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 8,
    marginVertical: 3,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
  },
  userAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginRight: 10 },
  userAvatarLg: { width: 46, height: 46, borderRadius: 23, marginRight: 0 },
  userAvatarText: { fontFamily: FONT_FAMILY.urbanistSemiBold, color: "#1a1a2e" },
  userAvatarTextLg: { fontFamily: FONT_FAMILY.urbanistSemiBold, color: "#1a1a2e", fontSize: 18 },
  userName: { fontSize: 14, color: "#0f172a", fontFamily: FONT_FAMILY.urbanistSemiBold },
  userLogin: { fontSize: 11, color: MUTED, marginTop: 2, fontFamily: FONT_FAMILY.urbanistRegular },
  adminBadge: { backgroundColor: "#fef3c7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginRight: 6 },
  adminBadgeText: { fontSize: 9, color: "#92400e", fontFamily: FONT_FAMILY.urbanistSemiBold, letterSpacing: 0.3 },
});

export default AppFeaturesScreen;
