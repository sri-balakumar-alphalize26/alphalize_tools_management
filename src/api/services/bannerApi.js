// Banner API — wraps Odoo `app.banner` (CRUD) using the existing
// odooApi helpers, with [BANNER] diagnostic logs so we can debug the
// round-trip from Metro's terminal (greppable alongside [SPLASH]/[LOGIN]).
//
// Backend module: odoo_modules/app_banner
// Model: app.banner
//   fields: id, name (Char), image (Binary base64), image_filename (Char),
//           sequence (Integer, default 10), active (Boolean, default True)
//   read:   base.group_user  (any logged-in user)
//   write:  base.group_system (admins only)
//
// Image is returned as a raw base64 string (no "data:" prefix). To
// render: `data:image/jpeg;base64,${b.image}`.

import useAuthStore from "@stores/auth/useAuthStore";
import {
  odooSearchRead,
  odooRead,
  odooCreate,
  odooWrite,
  odooUnlink,
} from "@api/services/odooApi";

const getAuth = () => useAuthStore.getState().odooAuth;

const _imgKB = (b64) =>
  b64 && typeof b64 === "string" ? Math.round((b64.length * 0.75) / 1024) : 0;

const _logErr = (op, e) => {
  console.warn(`[BANNER] ${op} error`, {
    message: e?.message || String(e),
    code: e?.code,
    status: e?.response?.status,
    odoo: e?.response?.data?.error?.data?.message,
  });
};

/**
 * Fetch all ACTIVE banners (for the home carousel).
 * Returns [] on any error so the carousel hides itself silently.
 */
export async function fetchActiveBanners() {
  const auth = getAuth();
  console.log("[BANNER] fetchActive calling", { hasAuth: !!auth });
  if (!auth) return [];
  try {
    const rows = await odooSearchRead(
      auth,
      "app.banner",
      [["active", "=", true]],
      ["id", "name", "sequence", "image"],
      { order: "sequence asc, id asc" }
    );
    const withImage = (rows || []).filter((r) => !!r.image);
    console.log("[BANNER] fetchActive ok", {
      rows: rows?.length || 0,
      withImage: withImage.length,
    });
    return withImage;
  } catch (e) {
    _logErr("fetchActive", e);
    return [];
  }
}

/**
 * Fetch ALL banners (active + inactive) for the admin list.
 * Returns { rows: [...] } on success, { error } on failure.
 */
export async function fetchAllBanners() {
  const auth = getAuth();
  console.log("[BANNER] fetchAll calling", { hasAuth: !!auth });
  if (!auth) return { error: "Not authenticated" };
  try {
    // active_test:false context bypasses the implicit active=true filter
    const rows = await odooSearchRead(
      auth,
      "app.banner",
      [],
      ["id", "name", "sequence", "active", "image"],
      { order: "sequence asc, id asc", context: { active_test: false } }
    );
    console.log("[BANNER] fetchAll ok", { rows: rows?.length || 0 });
    return { rows: rows || [] };
  } catch (e) {
    _logErr("fetchAll", e);
    return { error: e?.message || "Failed to fetch banners" };
  }
}

/**
 * Read a single banner for the edit form (includes image_filename).
 */
export async function fetchBannerById(id) {
  const auth = getAuth();
  console.log("[BANNER] readById calling", { id, hasAuth: !!auth });
  if (!auth) return null;
  try {
    const rows = await odooRead(auth, "app.banner", [id], [
      "id", "name", "sequence", "active", "image", "image_filename",
    ]);
    const row = rows?.[0] || null;
    console.log("[BANNER] readById ok", {
      id,
      name: row?.name,
      imageKB: _imgKB(row?.image),
    });
    return row;
  } catch (e) {
    _logErr("readById", e);
    return null;
  }
}

/**
 * Create a new banner. Image (base64 string) is required at the model
 * level; callers should always supply it.
 */
export async function createBanner({
  name = "",
  image,
  image_filename = "banner.jpg",
  sequence = 10,
  active = true,
} = {}) {
  const auth = getAuth();
  console.log("[BANNER] create calling", {
    name,
    sequence,
    active,
    imageKB: _imgKB(image),
    hasAuth: !!auth,
  });
  if (!auth) return { error: "Not authenticated" };
  if (!image) return { error: "Image is required" };
  try {
    const id = await odooCreate(auth, "app.banner", {
      name,
      image,
      image_filename,
      sequence: Number(sequence) || 10,
      active: !!active,
    });
    console.log("[BANNER] create ok", { id });
    return { id };
  } catch (e) {
    _logErr("create", e);
    return { error: e?.message || "Failed to create banner" };
  }
}

/**
 * Partial update — only fields explicitly passed get written.
 * This lets the admin toggle `active` without re-uploading bytes.
 */
export async function updateBanner({
  id,
  name,
  image,
  image_filename,
  sequence,
  active,
} = {}) {
  const auth = getAuth();
  if (!id) return { error: "id is required" };
  if (!auth) return { error: "Not authenticated" };

  const payload = {};
  if (name !== undefined) payload.name = name;
  if (image !== undefined) payload.image = image;
  if (image_filename !== undefined) payload.image_filename = image_filename;
  if (sequence !== undefined) payload.sequence = Number(sequence) || 10;
  if (active !== undefined) payload.active = !!active;

  console.log("[BANNER] update calling", {
    id,
    keys: Object.keys(payload),
    imageKB: payload.image ? _imgKB(payload.image) : "unchanged",
  });
  try {
    const ok = await odooWrite(auth, "app.banner", [id], payload);
    console.log("[BANNER] update ok", { id, ok });
    return { ok };
  } catch (e) {
    _logErr("update", e);
    return { error: e?.message || "Failed to update banner" };
  }
}

export async function deleteBanner(id) {
  const auth = getAuth();
  console.log("[BANNER] delete calling", { id });
  if (!auth) return { error: "Not authenticated" };
  if (!id) return { error: "id is required" };
  try {
    const ok = await odooUnlink(auth, "app.banner", [id]);
    console.log("[BANNER] delete ok", { id, ok });
    return { ok };
  } catch (e) {
    _logErr("delete", e);
    return { error: e?.message || "Failed to delete banner" };
  }
}
