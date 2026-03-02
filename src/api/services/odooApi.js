import axios from "axios";
import { ODOO_URL } from "../config/odooConfig";

// =============================================
// Odoo JSON-RPC Client
// =============================================

let requestId = 0;

const jsonRpc = async (url, service, method, args) => {
  requestId += 1;
  const payload = {
    jsonrpc: "2.0",
    method: "call",
    id: requestId,
    params: { service, method, args },
  };

  try {
    const response = await axios.post(url, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    });

    if (response.data.error) {
      const err = response.data.error;
      const msg = err.data?.message || err.message || "Odoo RPC Error";
      throw new Error(msg);
    }

    return response.data.result;
  } catch (error) {
    if (error.response) {
      throw new Error(`Odoo HTTP ${error.response.status}: ${error.response.statusText}`);
    } else if (error.request) {
      throw new Error("Cannot connect to Odoo server. Check IP and port.");
    }
    throw error;
  }
};

// =============================================
// Web JSON-RPC (for session-based calls)
// =============================================

let sessionCookie = null;

const webJsonRpc = async (endpoint, params = {}) => {
  requestId += 1;
  const payload = {
    jsonrpc: "2.0",
    method: "call",
    id: requestId,
    params,
  };

  const headers = { "Content-Type": "application/json" };
  if (sessionCookie) {
    headers["Cookie"] = sessionCookie;
  }

  try {
    const response = await axios.post(`${ODOO_URL}${endpoint}`, payload, {
      headers,
      timeout: 15000,
      withCredentials: true,
    });

    // Capture session cookie from response
    const setCookie = response.headers["set-cookie"];
    if (setCookie) {
      const match = Array.isArray(setCookie)
        ? setCookie.find((c) => c.includes("session_id"))
        : setCookie;
      if (match) {
        sessionCookie = match.split(";")[0];
      }
    }

    if (response.data.error) {
      const err = response.data.error;
      const msg = err.data?.message || err.message || "Odoo Web Error";
      throw new Error(msg);
    }

    return response.data.result;
  } catch (error) {
    if (error.message?.includes("Odoo")) throw error;
    if (error.response) {
      throw new Error(`Odoo HTTP ${error.response.status}`);
    }
    throw new Error("Cannot connect to Odoo. Check network.");
  }
};

// =============================================
// Authentication
// =============================================

export const odooAuthenticate = async (db, username, password) => {
  // Method 1: JSON-RPC common/login
  const uid = await jsonRpc(
    `${ODOO_URL}/jsonrpc`,
    "common",
    "login",
    [db, username, password]
  );

  if (!uid || uid === false) {
    throw new Error("Invalid username or password");
  }

  // Also create a web session for web-based calls
  try {
    await webJsonRpc("/web/session/authenticate", {
      db,
      login: username,
      password,
    });
  } catch (e) {
    // Web session is optional, JSON-RPC still works
    console.warn("Web session failed:", e.message);
  }

  return { uid, db, username, password };
};

export const odooGetDatabases = async () => {
  try {
    const result = await jsonRpc(
      `${ODOO_URL}/jsonrpc`,
      "db",
      "list",
      []
    );
    return result || [];
  } catch (e) {
    console.warn("Could not list databases:", e.message);
    return [];
  }
};

// =============================================
// CRUD Operations via JSON-RPC
// =============================================

const callOdoo = async (auth, model, method, args = [], kwargs = {}) => {
  return jsonRpc(
    `${ODOO_URL}/jsonrpc`,
    "object",
    "execute_kw",
    [auth.db, auth.uid, auth.password, model, method, args, kwargs]
  );
};

// Search & Read
export const odooSearchRead = async (auth, model, domain = [], fields = [], options = {}) => {
  const kwargs = { fields };
  if (options.limit) kwargs.limit = options.limit;
  if (options.offset) kwargs.offset = options.offset;
  if (options.order) kwargs.order = options.order;

  return callOdoo(auth, model, "search_read", [domain], kwargs);
};

// Search (returns IDs only)
export const odooSearch = async (auth, model, domain = [], options = {}) => {
  const kwargs = {};
  if (options.limit) kwargs.limit = options.limit;
  if (options.offset) kwargs.offset = options.offset;
  if (options.order) kwargs.order = options.order;

  return callOdoo(auth, model, "search", [domain], kwargs);
};

// Read specific IDs
export const odooRead = async (auth, model, ids, fields = []) => {
  return callOdoo(auth, model, "read", [ids], { fields });
};

// Create
export const odooCreate = async (auth, model, values) => {
  return callOdoo(auth, model, "create", [values]);
};

// Write (update)
export const odooWrite = async (auth, model, ids, values) => {
  return callOdoo(auth, model, "write", [ids, values]);
};

// Unlink (delete)
export const odooUnlink = async (auth, model, ids) => {
  return callOdoo(auth, model, "unlink", [ids]);
};

// Search count
export const odooSearchCount = async (auth, model, domain = []) => {
  return callOdoo(auth, model, "search_count", [domain]);
};

// Call custom method (for wizards, actions, etc.)
export const odooCallMethod = async (auth, model, method, ids = [], args = {}) => {
  return callOdoo(auth, model, method, [ids], args);
};

// Fields get (for introspection)
export const odooFieldsGet = async (auth, model, fields = [], attributes = []) => {
  return callOdoo(auth, model, "fields_get", [fields], { attributes });
};

export default {
  authenticate: odooAuthenticate,
  getDatabases: odooGetDatabases,
  searchRead: odooSearchRead,
  search: odooSearch,
  read: odooRead,
  create: odooCreate,
  write: odooWrite,
  unlink: odooUnlink,
  searchCount: odooSearchCount,
  callMethod: odooCallMethod,
  fieldsGet: odooFieldsGet,
};
