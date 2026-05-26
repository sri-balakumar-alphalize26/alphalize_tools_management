// Fetches the connected Odoo company's currency (symbol, name, position)
// and decimal.precision settings, so the app renders the right currency
// regardless of which Odoo server the device is configured against.

import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { saveCurrencyConfig, setActiveDigits } from "@utils/currency";

const JSONRPC_HEADERS = { "Content-Type": "application/json" };
const TIMEOUT_MS = 10000;

function normalizeUrl(baseUrl = "") {
  let url = baseUrl.trim();
  if (url && !url.startsWith("http")) url = "http://" + url;
  return url.replace(/\/+$/, "");
}

function executeKw(baseUrl, { db, uid, password, model, method, args, kwargs = {} }) {
  return axios.post(
    `${normalizeUrl(baseUrl)}/jsonrpc`,
    {
      jsonrpc: "2.0",
      method: "call",
      params: {
        service: "object",
        method: "execute_kw",
        args: [db, uid, password, model, method, args, kwargs],
      },
    },
    { headers: JSONRPC_HEADERS, timeout: TIMEOUT_MS }
  );
}

export async function fetchDecimalAccuracy(baseUrl, db, uid, password) {
  const res = await executeKw(baseUrl, {
    db, uid, password,
    model: "decimal.precision",
    method: "search_read",
    args: [[], ["name", "digits"]],
  });
  if (res.data?.error) {
    throw new Error(res.data.error.data?.message || "Failed to read decimal.precision");
  }
  const rows = Array.isArray(res.data?.result) ? res.data.result : [];
  const map = {};
  for (const r of rows) if (r?.name) map[r.name] = Number(r.digits) || 0;
  return map;
}

export async function fetchUserCompanyId(baseUrl, db, uid, password) {
  const res = await executeKw(baseUrl, {
    db, uid, password,
    model: "res.users",
    method: "read",
    args: [[uid], ["company_id"]],
  });
  if (res.data?.error) {
    throw new Error(res.data.error.data?.message || "Failed to read user");
  }
  const row = res.data?.result?.[0];
  const tuple = row?.company_id;
  if (!Array.isArray(tuple) || !tuple[0]) {
    throw new Error("User has no company_id");
  }
  return tuple[0];
}

export async function fetchCompanyCurrency(baseUrl, db, uid, password, companyId) {
  if (!companyId) throw new Error("companyId is required");

  const companyRes = await executeKw(baseUrl, {
    db, uid, password,
    model: "res.company",
    method: "read",
    args: [[companyId], ["currency_id"]],
  });
  if (companyRes.data?.error) {
    throw new Error(companyRes.data.error.data?.message || "Failed to read company");
  }
  const companyRow = companyRes.data?.result?.[0];
  const currencyTuple = companyRow?.currency_id;
  if (!Array.isArray(currencyTuple) || !currencyTuple[0]) {
    throw new Error("Company has no currency_id");
  }
  const currencyId = currencyTuple[0];

  const currencyRes = await executeKw(baseUrl, {
    db, uid, password,
    model: "res.currency",
    method: "read",
    args: [[currencyId], ["name", "symbol", "position"]],
  });
  if (currencyRes.data?.error) {
    throw new Error(currencyRes.data.error.data?.message || "Failed to read currency");
  }
  const currencyRow = currencyRes.data?.result?.[0];
  if (!currencyRow) throw new Error("Currency record not found");

  const position = currencyRow.position === "after" ? "after" : "before";
  return {
    symbol: currencyRow.symbol || currencyRow.name || "",
    name: currencyRow.name || "",
    position,
  };
}

// In-flight guard: Splash + post-login may both call refresh concurrently.
let _refreshInFlight = null;

export async function refreshCurrencyFromStorage() {
  if (_refreshInFlight) return _refreshInFlight;
  _refreshInFlight = (async () => _refreshImpl())().finally(() => {
    _refreshInFlight = null;
  });
  return _refreshInFlight;
}

async function _refreshImpl() {
  try {
    const pairs = await AsyncStorage.multiGet([
      "device_server_url",
      "device_db_name",
      "savedCredentials",
      "userData",
    ]);
    const deviceUrl = pairs[0][1];
    const deviceDb = pairs[1][1];
    const saved = pairs[2][1] ? JSON.parse(pairs[2][1]) : null;
    const user = pairs[3][1] ? JSON.parse(pairs[3][1]) : null;

    const baseUrl = deviceUrl || saved?.baseUrl;
    const db = deviceDb || saved?.db;
    const password = saved?.password;
    const uid = user?.uid;
    const companyId = Array.isArray(user?.company_id)
      ? user.company_id[0]
      : (user?.company_id || null);

    if (!baseUrl || !db || !password || !uid) return null;

    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId) {
      try {
        resolvedCompanyId = await fetchUserCompanyId(baseUrl, db, uid, password);
      } catch (_) {
        return null;
      }
    }

    const cfg = await fetchCompanyCurrency(baseUrl, db, uid, password, resolvedCompanyId);

    let digitsMap = null;
    try {
      digitsMap = await fetchDecimalAccuracy(baseUrl, db, uid, password);
      await AsyncStorage.setItem("decimalAccuracy", JSON.stringify(digitsMap));
      setActiveDigits(digitsMap);
    } catch (_) {}

    if (cfg && (cfg.symbol || cfg.name)) {
      await saveCurrencyConfig(cfg);
      return { ...cfg, _digitsMap: digitsMap };
    }
    return digitsMap ? { _digitsMap: digitsMap } : null;
  } catch (_) {
    return null;
  }
}
