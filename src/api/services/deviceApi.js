// Wraps all Odoo device_login_config endpoints.
// Uses bare `axios` on purpose so the app's interceptors (auth + offline
// modal) don't fire during normal "device not registered yet" paths.

import axios from "axios";

const JSONRPC_HEADERS = { "Content-Type": "application/json" };
const TIMEOUT_MS = 10000;
const DEFAULT_DEVICE_NAME = "NEX GENN Tool Management";

function normalizeUrl(baseUrl = "") {
  let url = baseUrl.trim();
  if (url && !url.startsWith("http")) url = "http://" + url;
  return url.replace(/\/+$/, "");
}

function jsonrpcBody(params) {
  return { jsonrpc: "2.0", method: "call", params };
}

export async function fetchDatabases(baseUrl) {
  const base = normalizeUrl(baseUrl);
  const opts = { headers: JSONRPC_HEADERS, timeout: TIMEOUT_MS };
  let lastError = null;

  try {
    const res = await axios.post(`${base}/device/databases`, jsonrpcBody({}), opts);
    const dbs = res.data?.result?.databases;
    if (Array.isArray(dbs) && dbs.length > 0) return dbs;
  } catch (err) {
    lastError = err;
  }

  try {
    const res = await axios.post(`${base}/web/database/list`, jsonrpcBody({}), opts);
    if (res.data?.error) throw new Error(res.data.error.data?.message || "list disabled");
    const result = res.data?.result;
    if (Array.isArray(result) && result.length > 0) return result;
    if (Array.isArray(result?.databases) && result.databases.length > 0) return result.databases;
  } catch (err) {
    lastError = err;
  }

  try {
    const res = await axios.get(`${base}/web/database/list`, { timeout: TIMEOUT_MS });
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.data?.result)) return res.data.result;
  } catch (err) {
    lastError = err;
  }

  if (lastError) throw lastError;
  return [];
}

export async function initDevice({ baseUrl, databaseName, deviceId, deviceName }) {
  const url = `${normalizeUrl(baseUrl)}/device/init`;
  const res = await axios.post(
    url,
    jsonrpcBody({
      base_url: normalizeUrl(baseUrl),
      database_name: databaseName,
      device_id: deviceId,
      device_name: deviceName || DEFAULT_DEVICE_NAME,
    }),
    { headers: JSONRPC_HEADERS, timeout: TIMEOUT_MS }
  );
  return res.data?.result || { registered: false, error: "Empty response from server" };
}

export async function deactivateDevice({ baseUrl, databaseName, deviceId }) {
  const url = `${normalizeUrl(baseUrl)}/device/deactivate`;
  console.log("[DEVICE] deactivateDevice -> calling", {
    url,
    databaseName,
    deviceId,
  });
  try {
    const res = await axios.post(
      url,
      jsonrpcBody({ database_name: databaseName, device_id: deviceId }),
      { headers: JSONRPC_HEADERS, timeout: TIMEOUT_MS }
    );
    const result = res.data?.result || { success: false };
    console.log("[DEVICE] deactivateDevice <- response", result);
    return result;
  } catch (err) {
    console.log("[DEVICE] deactivateDevice <- error", err?.message || err);
    throw err;
  }
}

export async function registerFromScan({ baseUrl, databaseName, deviceId, deviceName, recordId }) {
  const base = normalizeUrl(baseUrl);
  const res = await axios.post(
    `${base}/device/register-from-scan`,
    jsonrpcBody({
      device_id: deviceId,
      device_name: deviceName || DEFAULT_DEVICE_NAME,
      database_name: databaseName,
      base_url: base,
      record_id: recordId || null,
    }),
    { headers: JSONRPC_HEADERS, timeout: TIMEOUT_MS }
  );
  return res.data?.result || { status: "error", message: "Empty response from server" };
}

export async function authenticate(baseUrl, db, login, password) {
  const base = normalizeUrl(baseUrl);
  const res = await axios.post(
    `${base}/web/session/authenticate`,
    jsonrpcBody({ db, login, password }),
    { headers: JSONRPC_HEADERS, timeout: TIMEOUT_MS }
  );
  return res.data?.result || { uid: false };
}

export async function isModuleInstalled(baseUrl, db, uid, password, moduleName) {
  const base = normalizeUrl(baseUrl);
  const res = await axios.post(
    `${base}/jsonrpc`,
    {
      jsonrpc: "2.0",
      method: "call",
      params: {
        service: "object",
        method: "execute_kw",
        args: [
          db,
          uid,
          password,
          "ir.module.module",
          "search_count",
          [[["name", "=", moduleName], ["state", "=", "installed"]]],
        ],
      },
    },
    { headers: JSONRPC_HEADERS, timeout: TIMEOUT_MS }
  );
  return (res.data?.result || 0) > 0;
}
