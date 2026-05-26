import AsyncStorage from "@react-native-async-storage/async-storage";

const FALLBACK_CURRENCY = { symbol: "", name: "", position: "before" };

// Module-level caches so non-hook code (helpers, PDF generators, etc.) can
// read the active currency / decimals without prop drilling.
let _activeCurrency = FALLBACK_CURRENCY;
let _activeDigits = {};

export const setActiveCurrency = (cfg) => {
  if (cfg && typeof cfg === "object") {
    _activeCurrency = { ...FALLBACK_CURRENCY, ...cfg };
  }
};

export const getActiveCurrency = () => _activeCurrency;

export const setActiveDigits = (map) => {
  if (map && typeof map === "object") {
    _activeDigits = { ...map };
  }
};

export const getActiveDigits = () => _activeDigits;

export const getDigits = (usage, fallback = 2) => {
  const v = _activeDigits?.[usage];
  return Number.isFinite(v) ? v : fallback;
};

export const getCurrencyConfig = async () => {
  try {
    const raw = await AsyncStorage.getItem("currencyConfig");
    if (raw) {
      const parsed = JSON.parse(raw);
      setActiveCurrency(parsed);
      return parsed;
    }
    return _activeCurrency;
  } catch (_) {
    return _activeCurrency;
  }
};

export const saveCurrencyConfig = async (cfg) => {
  try {
    await AsyncStorage.setItem("currencyConfig", JSON.stringify(cfg));
    setActiveCurrency(cfg);
  } catch (_) {}
};

export const formatCurrency = (amount, currencyConfig) => {
  if (amount === null || amount === undefined) amount = 0;
  const cfg = currencyConfig || _activeCurrency;
  const digits = getDigits("Product Price", 2);
  const formatted = parseFloat(amount).toFixed(digits);
  const symbol = cfg.symbol || cfg.name || "";
  const position = cfg.position || "before";
  if (position === "after") {
    return `${formatted}${symbol ? " " + symbol : ""}`;
  }
  return `${symbol}${formatted}`;
};

export const formatNumber = (n) => {
  if (n === null || n === undefined) return "0";
  return parseFloat(n).toLocaleString("en-US");
};
