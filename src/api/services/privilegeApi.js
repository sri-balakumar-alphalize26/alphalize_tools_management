// Privilege admin API — talks to the forked Odoo module
// `tool_rental_privilege_manager` (`.rental` models). Mirrors the Grocery
// app's privilege helpers but uses this app's execute_kw client (odooApi).
//
// Every function takes the `auth` object (from useAuthStore.odooAuth) as its
// first argument. Read helpers swallow errors and return safe defaults;
// mutation helpers let the RPC error propagate so the screen can toast/roll back.
import { odooSearchRead, odooExecute } from "@api/services/odooApi";

const FEATURE_MODEL = "app.feature.rental";
const FEATURE_VIS_MODEL = "app.feature.visibility.rental";

const FEATURE_FIELDS = ["id", "feature_key", "name", "description", "sequence", "parent_id"];
const USER_FIELDS = ["id", "name", "login", "active"];

export const ZERO_STATS = { groups: 0, modules: 0, hidden_menus: 0, hidden_apps: 0, hidden_features: 0 };

// All active app-feature catalog records (the gateable tiles/buttons).
export const fetchAppFeatures = async (auth) => {
  try {
    const rows = await odooSearchRead(
      auth,
      FEATURE_MODEL,
      [["active", "=", true]],
      FEATURE_FIELDS,
      { order: "sequence asc, name asc" },
    );
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    console.warn("[FeatureAdmin] fetchAppFeatures failed:", err?.message || err);
    return [];
  }
};

// Internal (non-shared) users for the picker, optional name/login search.
export const fetchUsers = async (auth, searchText = "", offset = 0) => {
  try {
    const domain = [["share", "=", false]];
    if (searchText) {
      domain.push("|", ["name", "ilike", searchText], ["login", "ilike", searchText]);
    }
    const rows = await odooSearchRead(auth, "res.users", domain, USER_FIELDS, {
      order: "name asc",
      limit: 50,
      offset,
    });
    return (Array.isArray(rows) ? rows : []).map((u) => ({
      ...u,
      // Lightweight admin heuristic for the warning banner; privilege rules
      // never apply to Odoo's base.group_system admins.
      _isAdmin: u.id === 2 || u.login === "admin",
    }));
  } catch (err) {
    console.warn("[FeatureAdmin] fetchUsers failed:", err?.message || err);
    return [];
  }
};

// Runtime gating: the feature_key strings hidden for a user (user + role hides
// merged server-side; returns [] for admins). Tag UI with these keys to gate it.
export const fetchHiddenFeatureKeys = async (auth, userId) => {
  if (!userId) return [];
  try {
    const keys = await odooExecute(
      auth,
      FEATURE_VIS_MODEL,
      "get_hidden_features_for_user",
      [Number(userId)],
    );
    const result = Array.isArray(keys) ? keys.filter(Boolean) : [];
    console.log("[FeatureGate] get_hidden_features_for_user(", userId, ") =>", result);
    return result;
  } catch (err) {
    console.warn("[FeatureGate] fetchHiddenFeatureKeys failed:", err?.message || err);
    return [];
  }
};

// Rows of features hidden for a user (admin view): [{id, feature_id, feature_key, ...}].
export const fetchHiddenFeaturesForUserAdmin = async (auth, userId) => {
  if (!userId) return [];
  try {
    const rows = await odooExecute(
      auth,
      FEATURE_VIS_MODEL,
      "get_user_hides_for_admin",
      [Number(userId)],
    );
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    console.warn("[FeatureAdmin] fetchHiddenFeaturesForUserAdmin failed:", err?.message || err);
    return [];
  }
};

// Privilege summary counts for the stat tile.
export const fetchPrivilegeStats = async (auth, userId) => {
  if (!userId) return { ...ZERO_STATS };
  try {
    const res = await odooExecute(
      auth,
      FEATURE_VIS_MODEL,
      "get_privilege_stats_for_user",
      [Number(userId)],
    );
    return { ...ZERO_STATS, ...(res || {}) };
  } catch (err) {
    console.warn("[FeatureAdmin] fetchPrivilegeStats failed:", err?.message || err);
    return { ...ZERO_STATS };
  }
};

// Toggle a single (user, feature) hide. Throws on failure.
export const toggleFeatureHidden = async (auth, userId, featureId, hidden) => {
  if (!userId || !featureId) throw new Error("userId and featureId are required");
  return odooExecute(
    auth,
    FEATURE_VIS_MODEL,
    "toggle_user_hide_admin",
    [Number(userId), Number(featureId), Boolean(hidden)],
  );
};

// Bulk-hide every defined feature for a user. Throws on failure.
export const hideAllFeatures = async (auth, userId) => {
  if (!userId) throw new Error("userId is required");
  return odooExecute(auth, FEATURE_VIS_MODEL, "hide_all_features_for_user", [Number(userId)]);
};

// Bulk-clear every hide for a user. Throws on failure.
export const clearAllHides = async (auth, userId) => {
  if (!userId) throw new Error("userId is required");
  return odooExecute(auth, FEATURE_VIS_MODEL, "clear_all_hides_for_user", [Number(userId)]);
};
