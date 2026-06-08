import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import XLSX from "xlsx";

import { SafeAreaView, RoundedContainer } from "@components/containers";
import NavigationHeader from "@components/Header/NavigationHeader";
import { showToastMessage } from "@components/Toast";
import { COLORS } from "@constants/theme";
import useToolStore from "@stores/toolManagement/useToolStore";
import useAuthStore from "@stores/auth/useAuthStore";
import { formatCurrency } from "@utils/currency";

// ── Period bounds helper ─────────────────────────────────────────────
const periodBounds = (period, customFrom, customTo) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  switch (period) {
    case "today":
      return [startOfDay, endOfDay];
    case "week": {
      const day = now.getDay() || 7;
      const monday = new Date(startOfDay);
      monday.setDate(monday.getDate() - (day - 1));
      return [monday, endOfDay];
    }
    case "month":
      return [new Date(now.getFullYear(), now.getMonth(), 1), endOfDay];
    case "year":
      return [new Date(now.getFullYear(), 0, 1), endOfDay];
    case "custom": {
      const from = customFrom ? new Date(customFrom) : null;
      const to = customTo ? new Date(customTo + "T23:59:59") : null;
      return [from, to];
    }
    case "all":
    default:
      return [null, null];
  }
};

const PERIOD_LABELS = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  year: "This Year",
  all: "All Time",
  custom: "Custom Range",
};

const todayStamp = () => {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
};

const escHtml = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// ── Dropdown picker (lifted from OrderReportsScreen) ────────────────
const DropdownPicker = ({ label, value, options, onSelect }) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={{ minWidth: 110 }}>
      <TouchableOpacity style={dropStyles.trigger} onPress={() => setOpen(true)}>
        <Text style={dropStyles.triggerText} numberOfLines={1}>
          {selected?.label || label}
        </Text>
        <Text style={dropStyles.arrow}>{"\u25BC"}</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={dropStyles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={dropStyles.menu}>
            <Text style={dropStyles.menuTitle}>{label}</Text>
            <ScrollView style={{ maxHeight: 350 }}>
              {options.map((opt) => (
                <TouchableOpacity
                  key={String(opt.value)}
                  style={[dropStyles.menuItem, value === opt.value && dropStyles.menuItemActive]}
                  onPress={() => {
                    onSelect(opt.value);
                    setOpen(false);
                  }}
                >
                  <Text
                    style={[
                      dropStyles.menuItemText,
                      value === opt.value && dropStyles.menuItemTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// ── Calendar popup (date <= today only) ─────────────────────────────
const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const START_YEAR = 2000;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const fmtDate = (y, m, d) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const CalendarPicker = ({ visible, value, onSelect, onClose, minDate }) => {
  const today = startOfDay(new Date());
  const initial = value ? new Date(value + "T00:00:00") : today;
  const [currentYear, setCurrentYear] = useState(initial.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(initial.getMonth());
  const [viewMode, setViewMode] = useState("days"); // "days" | "months" | "years"

  // Always start on the day grid when the popup opens.
  useEffect(() => {
    if (visible) {
      console.log("[CAL] picker opened", { value, minDate, currentYear, currentMonth });
      setViewMode("days");
    }
  }, [visible]);

  const min = minDate ? startOfDay(new Date(minDate + "T00:00:00")) : null;

  const weeks = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const out = [];
    let week = new Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      week.push(d);
      if (week.length === 7) {
        out.push(week);
        week = [];
      }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      out.push(week);
    }
    return out;
  }, [currentYear, currentMonth]);

  const isCurrentMonth =
    currentYear === today.getFullYear() && currentMonth === today.getMonth();

  const goPrev = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else setCurrentMonth(currentMonth - 1);
  };
  const goNext = () => {
    if (isCurrentMonth) return; // never page into the future
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else setCurrentMonth(currentMonth + 1);
  };

  const pickYear = (y) => {
    console.log("[CAL] year picked", y);
    setCurrentYear(y);
    // Clamp into the past so we never land on a future month/year.
    if (y === today.getFullYear() && currentMonth > today.getMonth()) {
      setCurrentMonth(today.getMonth());
    }
    setViewMode("months");
  };

  const years = [];
  for (let y = today.getFullYear(); y >= START_YEAR; y--) years.push(y);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={calStyles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={calStyles.card} onPress={() => {}}>
          {/* Header */}
          <View style={calStyles.navRow}>
            <TouchableOpacity
              onPress={goPrev}
              disabled={viewMode !== "days"}
              style={calStyles.navBtn}
            >
              <Text style={[calStyles.navBtnText, viewMode !== "days" && calStyles.navBtnDisabled]}>
                {"◀"}
              </Text>
            </TouchableOpacity>

            <View style={calStyles.headerCenter}>
              <TouchableOpacity
                style={calStyles.headerPick}
                onPress={() => {
                  const next = viewMode === "months" ? "days" : "months";
                  console.log("[CAL] tap month header ->", next);
                  setViewMode(next);
                }}
              >
                <Text style={calStyles.monthName}>{MONTH_FULL[currentMonth]}</Text>
                <Text style={calStyles.headerArrow}>{"▾"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={calStyles.headerPick}
                onPress={() => {
                  const next = viewMode === "years" ? "days" : "years";
                  console.log("[CAL] tap year header ->", next);
                  setViewMode(next);
                }}
              >
                <Text style={calStyles.yearLabel}>{currentYear}</Text>
                <Text style={calStyles.headerArrow}>{"▾"}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={goNext}
              disabled={viewMode !== "days" || isCurrentMonth}
              style={calStyles.navBtn}
            >
              <Text
                style={[
                  calStyles.navBtnText,
                  (viewMode !== "days" || isCurrentMonth) && calStyles.navBtnDisabled,
                ]}
              >
                {"▶"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* YEARS VIEW */}
          {viewMode === "years" && (
            <ScrollView style={{ maxHeight: 260 }}>
              <View style={calStyles.pickGrid}>
                {years.map((y) => {
                  const isSel = y === currentYear;
                  return (
                    <TouchableOpacity
                      key={y}
                      style={[calStyles.pickCell, isSel && calStyles.pickCellSelected]}
                      onPress={() => pickYear(y)}
                    >
                      <Text style={[calStyles.pickText, isSel && calStyles.pickTextSelected]}>{y}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {/* MONTHS VIEW */}
          {viewMode === "months" && (
            <View style={calStyles.pickGrid}>
              {MONTH_SHORT.map((m, idx) => {
                const isFutureMonth =
                  currentYear === today.getFullYear() && idx > today.getMonth();
                const isSel = idx === currentMonth;
                return (
                  <TouchableOpacity
                    key={m}
                    disabled={isFutureMonth}
                    style={[
                      calStyles.pickCell,
                      isSel && calStyles.pickCellSelected,
                      isFutureMonth && calStyles.pickCellDisabled,
                    ]}
                    onPress={() => {
                      console.log("[CAL] month picked", { month: idx, label: m });
                      setCurrentMonth(idx);
                      setViewMode("days");
                    }}
                  >
                    <Text
                      style={[
                        calStyles.pickText,
                        isSel && calStyles.pickTextSelected,
                        isFutureMonth && calStyles.pickTextDisabled,
                      ]}
                    >
                      {m}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* DAYS VIEW */}
          {viewMode === "days" && (
            <>
              {/* Day names */}
              <View style={calStyles.weekRow}>
                {DAY_NAMES.map((d) => (
                  <View key={d} style={calStyles.dayNameCell}>
                    <Text style={calStyles.dayNameText}>{d}</Text>
                  </View>
                ))}
              </View>

              {/* Grid */}
              {weeks.map((week, wIdx) => (
                <View key={wIdx} style={calStyles.weekRow}>
                  {week.map((day, cIdx) => {
                    if (!day) return <View key={cIdx} style={calStyles.emptyCell} />;
                    const cellDate = new Date(currentYear, currentMonth, day);
                    const dateStr = fmtDate(currentYear, currentMonth, day);
                    const isFuture = cellDate > today;
                    const isBeforeMin = min && cellDate < min;
                    const disabled = isFuture || isBeforeMin;
                    const isSelected = value === dateStr;
                    return (
                      <TouchableOpacity
                        key={cIdx}
                        disabled={disabled}
                        activeOpacity={0.7}
                        style={[
                          calStyles.dayCell,
                          isSelected && calStyles.dayCellSelected,
                          disabled && calStyles.dayCellDisabled,
                        ]}
                        onPress={() => {
                          onSelect(dateStr);
                          onClose();
                        }}
                      >
                        <Text
                          style={[
                            calStyles.dayNum,
                            isSelected && calStyles.dayNumSelected,
                            disabled && calStyles.dayNumDisabled,
                          ]}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const TOP_N_OPTIONS = [
  { label: "Show All", value: 0 },
  { label: "Top 2", value: 2 },
  { label: "Top 3", value: 3 },
  { label: "Top 4", value: 4 },
  { label: "Top 5", value: 5 },
  { label: "Top 10", value: 10 },
];

// ════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ════════════════════════════════════════════════════════════════════
const SalesReportScreen = ({ navigation }) => {
  const odooAuth = useAuthStore((s) => s.odooAuth);
  const orders = useToolStore((s) => s.orders);
  const fetchOrders = useToolStore((s) => s.fetchOrders);

  const [period, setPeriod] = useState("all");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [showFromCal, setShowFromCal] = useState(false);
  const [showToCal, setShowToCal] = useState(false);
  const [customerLimit, setCustomerLimit] = useState(0);
  const [toolLimit, setToolLimit] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    console.log("[SALES] mount", {
      hasOdooAuth: !!odooAuth,
      uid: odooAuth?.uid,
      db: odooAuth?.db,
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      console.log("[SALES] focus refresh", {
        hasAuth: !!odooAuth,
        ordersInStore: (orders || []).length,
      });
      if (odooAuth) fetchOrders(odooAuth);
    }, [odooAuth])
  );

  const formatMoney = (val) => formatCurrency(val);
  const formatNumber = (val) => String(Math.round(parseFloat(val) || 0));

  // ── Aggregation ────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const [from, to] = periodBounds(period, customDateFrom, customDateTo);

    const filteredOrders = (orders || []).filter((o) => {
      if (!["checked_in", "invoiced"].includes(o.state)) return false;
      const raw = o.date_checkin || o.date_order;
      if (!raw) return false;
      const d = new Date(raw);
      if (from && d < from) return false;
      if (to && d > to) return false;
      // Payment method filter (prefer check-in method, fall back to checkout)
      if (paymentMethod !== "all") {
        const pm = o.checkin_payment_method || o.payment_method || "";
        if (pm !== paymentMethod) return false;
      }
      return true;
    });

    console.log("[SALES] filter result", {
      period,
      paymentMethod,
      from: from?.toISOString?.() || null,
      to: to?.toISOString?.() || null,
      ordersIn: (orders || []).length,
      filteredOut: (orders || []).length - filteredOrders.length,
      filteredIn: filteredOrders.length,
    });

    let totalRevenue = 0,
      totalTax = 0,
      totalDamage = 0,
      totalLate = 0,
      totalDiscount = 0;
    const customerAgg = {};

    for (const o of filteredOrders) {
      totalRevenue += parseFloat(o.total_amount || 0);
      totalTax += parseFloat(o.tax_total || 0);
      totalDamage += parseFloat(o.damage_charges || 0);
      totalLate += parseFloat(o.late_fee || 0);
      totalDiscount += parseFloat(o.discount_amount || 0);
      const pid = o.partner_id || o.partner_name || "unknown";
      if (!customerAgg[pid]) {
        customerAgg[pid] = {
          id: pid,
          name: o.partner_name || "Unknown",
          count: 0,
          revenue: 0,
        };
      }
      customerAgg[pid].count += 1;
      customerAgg[pid].revenue += parseFloat(o.total_amount || 0);
    }

    const customers = Object.values(customerAgg).sort((a, b) => b.revenue - a.revenue);

    const toolAgg = {};
    for (const o of filteredOrders) {
      for (const line of o.lines || []) {
        const name = line.tool_name || "Unknown Tool";
        if (!toolAgg[name]) toolAgg[name] = { name, qty: 0, revenue: 0 };
        toolAgg[name].qty += parseFloat(line.quantity || 0);
        toolAgg[name].revenue += parseFloat(line.total_cost || 0);
      }
    }
    const tools = Object.values(toolAgg).sort((a, b) => b.revenue - a.revenue);

    console.log("[SALES] summary", {
      totalRevenue,
      totalOrders: filteredOrders.length,
      uniqueCustomers: customers.length,
      uniqueTools: tools.length,
    });

    return {
      totalRevenue,
      totalOrders: filteredOrders.length,
      avgOrderValue: filteredOrders.length ? totalRevenue / filteredOrders.length : 0,
      totalTax,
      totalDamage,
      totalLate,
      totalDiscount,
      netRevenue: totalRevenue - totalDiscount,
      customers,
      tools,
    };
  }, [orders, period, customDateFrom, customDateTo, paymentMethod]);

  const displayCustomers =
    customerLimit > 0 ? summary.customers.slice(0, customerLimit) : summary.customers;
  const displayTools = toolLimit > 0 ? summary.tools.slice(0, toolLimit) : summary.tools;

  const PAYMENT_LABELS = { all: "All Payments", cash: "Cash", card: "Card", bank: "Bank", credit: "Credit" };
  const basePeriodLabel = PERIOD_LABELS[period] || "";
  const periodLabel =
    paymentMethod !== "all"
      ? basePeriodLabel + " · " + (PAYMENT_LABELS[paymentMethod] || paymentMethod)
      : basePeriodLabel;

  // ── Section helpers (used by both PDF + Excel builders) ───────────
  const customerSection = () => ({
    name: "Customers Ranked",
    headers: ["Rank", "Customer", "Orders", "Revenue"],
    rows: displayCustomers.map((c, i) => [i + 1, c.name, c.count, formatMoney(c.revenue)]),
  });

  const toolSection = () => ({
    name: "Tools Ranked",
    headers: ["Rank", "Tool", "Times Rented", "Revenue"],
    rows: displayTools.map((t, i) => [i + 1, t.name, formatNumber(t.qty), formatMoney(t.revenue)]),
  });

  const kpiSection = () => ({
    name: "Summary",
    headers: ["Metric", "Value"],
    rows: [
      ["Total Revenue", formatMoney(summary.totalRevenue)],
      ["Total Orders", summary.totalOrders],
      ["Avg Order Value", formatMoney(summary.avgOrderValue)],
      ["Tax Collected", formatMoney(summary.totalTax)],
      ["Damage Charges", formatMoney(summary.totalDamage)],
      ["Late Fees", formatMoney(summary.totalLate)],
      ["Discounts Given", formatMoney(summary.totalDiscount)],
      ["Net Revenue", formatMoney(summary.netRevenue)],
    ],
  });

  // ── PDF (HTML for Print.printToFileAsync) ─────────────────────────
  const buildPdfHtml = (title, sections) => {
    let body =
      "<h2 style='color:#714B67;margin:0 0 4px 0;'>" +
      escHtml(title) +
      "</h2>" +
      "<div style='color:#666;font-size:12px;margin-bottom:14px;'>Period: <b>" +
      escHtml(periodLabel) +
      "</b> &middot; Generated: " +
      escHtml(new Date().toLocaleString()) +
      "</div>";

    for (const sec of sections) {
      body +=
        "<h3 style='color:#333;margin:14px 0 4px 0;'>" + escHtml(sec.name) + "</h3>";
      body +=
        "<table style='width:100%;border-collapse:collapse;font-size:12px;'><thead>" +
        "<tr style='background:#714B67;color:#fff;'>";
      for (const h of sec.headers) {
        body +=
          "<th style='padding:6px 8px;text-align:left;border:1px solid #ddd;'>" +
          escHtml(h) +
          "</th>";
      }
      body += "</tr></thead><tbody>";
      for (const row of sec.rows) {
        body += "<tr>";
        for (const cell of row) {
          body +=
            "<td style='padding:5px 8px;border:1px solid #ddd;'>" +
            escHtml(cell) +
            "</td>";
        }
        body += "</tr>";
      }
      body += "</tbody></table>";
    }

    return (
      "<html><head><meta charset='UTF-8'/><title>" +
      escHtml(title) +
      "</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#222;}h2,h3{margin:0;}</style></head><body>" +
      body +
      "</body></html>"
    );
  };

  // ── Excel (xlsx package) ──────────────────────────────────────────
  const buildExcelBase64 = (title, sections) => {
    const wb = XLSX.utils.book_new();
    for (const sec of sections) {
      // Section header row + headers + rows
      const aoa = [
        [title],
        ["Period: " + periodLabel + "  |  Generated: " + new Date().toLocaleString()],
        [],
        [sec.name],
        sec.headers,
        ...sec.rows,
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      // Column widths: rank / name / count / money
      ws["!cols"] = [{ wch: 8 }, { wch: 32 }, { wch: 16 }, { wch: 20 }];
      const sheetName = sec.name.substring(0, 28).replace(/[\\/?*[\]]/g, " ");
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
    return XLSX.write(wb, { type: "base64", bookType: "xlsx" });
  };

  // ── Save / share helper (lifted from ToolAvailabilityScreen) ──────
  const saveOrShare = async (filename, mimeType, base64Data) => {
    if (Platform.OS === "android") {
      try {
        const SAF = FileSystem.StorageAccessFramework;
        const perm = await SAF.requestDirectoryPermissionsAsync();
        if (perm.granted) {
          const uri = await SAF.createFileAsync(perm.directoryUri, filename, mimeType);
          await FileSystem.writeAsStringAsync(uri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          showToastMessage("Saved " + filename);
          return;
        }
      } catch (e) {
        // fall through to share
      }
    }
    // Fallback (denied permission, or iOS): write to cache + share sheet
    const tmp = FileSystem.cacheDirectory + filename;
    await FileSystem.writeAsStringAsync(tmp, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await Sharing.shareAsync(tmp, { mimeType });
  };

  const downloadPdf = async (filename, sections, title) => {
    setDownloading("pdf-" + filename);
    try {
      const html = buildPdfHtml(title, sections);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await saveOrShare(filename, "application/pdf", base64);
    } catch (e) {
      console.log("PDF download error:", e);
      showToastMessage("PDF download failed: " + (e.message || "error"));
    } finally {
      setDownloading(null);
    }
  };

  const downloadExcel = async (filename, sections, title) => {
    setDownloading("xlsx-" + filename);
    try {
      const base64 = buildExcelBase64(title, sections);
      await saveOrShare(
        filename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        base64
      );
    } catch (e) {
      console.log("Excel download error:", e);
      showToastMessage("Excel download failed: " + (e.message || "error"));
    } finally {
      setDownloading(null);
    }
  };

  const stamp = todayStamp();
  const downloadCustomersPdf = () =>
    downloadPdf("customers_ranked_" + stamp + ".pdf", [customerSection()], "Sales Report — Customers Ranked");
  const downloadCustomersExcel = () =>
    downloadExcel("customers_ranked_" + stamp + ".xlsx", [customerSection()], "Sales Report — Customers Ranked");
  const downloadToolsPdf = () =>
    downloadPdf("tools_ranked_" + stamp + ".pdf", [toolSection()], "Sales Report — Tools Ranked");
  const downloadToolsExcel = () =>
    downloadExcel("tools_ranked_" + stamp + ".xlsx", [toolSection()], "Sales Report — Tools Ranked");
  const downloadFullPdf = () =>
    downloadPdf(
      "sales_report_" + stamp + ".pdf",
      [kpiSection(), customerSection(), toolSection()],
      "Sales Report"
    );
  const downloadFullExcel = () =>
    downloadExcel(
      "sales_report_" + stamp + ".xlsx",
      [kpiSection(), customerSection(), toolSection()],
      "Sales Report"
    );

  // ── KPI cards data ────────────────────────────────────────────────
  const kpiCards = [
    { label: "Total Revenue", value: formatMoney(summary.totalRevenue), accent: "#714B67" },
    { label: "Total Orders", value: formatNumber(summary.totalOrders), accent: "#007BFF" },
    { label: "Avg Order Value", value: formatMoney(summary.avgOrderValue), accent: "#17A2B8" },
    { label: "Tax Collected", value: formatMoney(summary.totalTax), accent: "#FD7E14" },
    { label: "Damage Charges", value: formatMoney(summary.totalDamage), accent: "#DC3545" },
    { label: "Late Fees", value: formatMoney(summary.totalLate), accent: "#FFC107" },
    { label: "Discounts Given", value: formatMoney(summary.totalDiscount), accent: "#28A745" },
    { label: "Net Revenue", value: formatMoney(summary.netRevenue), accent: "#4A2F44" },
  ];

  const periodPills = [
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
    { key: "year", label: "This Year" },
    { key: "all", label: "All Time" },
  ];

  return (
    <SafeAreaView>
      <NavigationHeader title="Sales Report" navigation={navigation} />
      <RoundedContainer>
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
          {/* HEADER ACTIONS */}
          <View style={styles.headerRow}>
            <Text style={styles.headerSubtitle}>
              {periodLabel} · {summary.totalOrders} orders
            </Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.headerBtn, { backgroundColor: "#DC3545" }]}
                onPress={downloadFullPdf}
                disabled={!!downloading}
              >
                <Text style={styles.headerBtnText}>⬇ Full PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerBtn, { backgroundColor: "#28A745" }]}
                onPress={downloadFullExcel}
                disabled={!!downloading}
              >
                <Text style={styles.headerBtnText}>⬇ Full Excel</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* PERIOD PILLS */}
          <View style={styles.pillBar}>
            {periodPills.map((p) => (
              <TouchableOpacity
                key={p.key}
                style={[styles.pill, period === p.key && styles.pillActive]}
                onPress={() => setPeriod(p.key)}
              >
                <Text style={[styles.pillText, period === p.key && styles.pillTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* CUSTOM RANGE */}
          <View style={styles.customRow}>
            <Text style={styles.customLabel}>Custom:</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => {
                console.log("[CAL] open From picker", { customDateFrom });
                setShowFromCal(true);
              }}
            >
              <Text style={styles.dateInputIcon}>{"📅"}</Text>
              <Text style={customDateFrom ? styles.dateInputText : styles.dateInputPlaceholder}>
                {customDateFrom || "YYYY-MM-DD"}
              </Text>
              {!!customDateFrom && (
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => {
                    console.log("[CAL] clear From");
                    setCustomDateFrom("");
                  }}
                >
                  <Text style={styles.dateInputClear}>{"✕"}</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            <Text style={styles.toLabel}>to</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => {
                console.log("[CAL] open To picker", { customDateTo, minDate: customDateFrom });
                setShowToCal(true);
              }}
            >
              <Text style={styles.dateInputIcon}>{"📅"}</Text>
              <Text style={customDateTo ? styles.dateInputText : styles.dateInputPlaceholder}>
                {customDateTo || "YYYY-MM-DD"}
              </Text>
              {!!customDateTo && (
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => {
                    console.log("[CAL] clear To");
                    setCustomDateTo("");
                  }}
                >
                  <Text style={styles.dateInputClear}>{"✕"}</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>

          <CalendarPicker
            visible={showFromCal}
            value={customDateFrom}
            onClose={() => setShowFromCal(false)}
            onSelect={(d) => {
              console.log("[CAL] From selected", d);
              setCustomDateFrom(d);
              setPeriod("custom");
            }}
          />
          <CalendarPicker
            visible={showToCal}
            value={customDateTo}
            minDate={customDateFrom || undefined}
            onClose={() => setShowToCal(false)}
            onSelect={(d) => {
              console.log("[CAL] To selected", d);
              setCustomDateTo(d);
              setPeriod("custom");
            }}
          />

          {/* PAYMENT METHOD PILLS */}
          <View style={styles.pillBar}>
            {[
              { key: "all", label: "All" },
              { key: "cash", label: "💵 Cash" },
              { key: "card", label: "💳 Card" },
              { key: "bank", label: "🏦 Bank" },
              { key: "credit", label: "📋 Credit" },
            ].map((p) => (
              <TouchableOpacity
                key={p.key}
                style={[styles.pill, paymentMethod === p.key && styles.pillActiveDark]}
                onPress={() => setPaymentMethod(p.key)}
              >
                <Text style={[styles.pillText, paymentMethod === p.key && styles.pillTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* KPI CARDS */}
          <View style={styles.kpiGrid}>
            {kpiCards.map((c) => (
              <View key={c.label} style={[styles.kpiCard, { borderLeftColor: c.accent }]}>
                <Text style={styles.kpiLabel}>{c.label}</Text>
                <Text style={[styles.kpiValue, { color: c.accent }]}>{c.value}</Text>
              </View>
            ))}
          </View>

          {/* CUSTOMERS RANKED */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>🏆 Customers Ranked</Text>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.miniBtnRed}
                  onPress={downloadCustomersPdf}
                  disabled={!!downloading}
                >
                  <Text style={styles.miniBtnRedText}>⬇ PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.miniBtnGreen}
                  onPress={downloadCustomersExcel}
                  disabled={!!downloading}
                >
                  <Text style={styles.miniBtnGreenText}>⬇ Excel</Text>
                </TouchableOpacity>
                <DropdownPicker
                  label="Top N"
                  value={customerLimit}
                  options={TOP_N_OPTIONS}
                  onSelect={setCustomerLimit}
                />
              </View>
            </View>
            <Text style={styles.countText}>
              {displayCustomers.length} / {summary.customers.length}
            </Text>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.thCell, { width: 40 }]}>#</Text>
              <Text style={[styles.thCell, { flex: 1 }]}>Customer</Text>
              <Text style={[styles.thCell, { width: 60, textAlign: "right" }]}>Orders</Text>
              <Text style={[styles.thCell, { width: 100, textAlign: "right" }]}>Revenue</Text>
            </View>
            {displayCustomers.length === 0 ? (
              <Text style={styles.emptyText}>No data for this period</Text>
            ) : (
              displayCustomers.map((c, i) => (
                <View key={String(c.id) + i} style={styles.tableRow}>
                  <Text style={[styles.tdCell, { width: 40, color: "#714B67", fontWeight: "700" }]}>
                    {i + 1}
                  </Text>
                  <Text style={[styles.tdCell, { flex: 1, fontWeight: "600" }]} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={[styles.tdCell, { width: 60, textAlign: "right" }]}>{c.count}</Text>
                  <Text
                    style={[
                      styles.tdCell,
                      { width: 100, textAlign: "right", color: "#28A745", fontWeight: "700" },
                    ]}
                  >
                    {formatMoney(c.revenue)}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* TOOLS RANKED */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>🔧 Tools Ranked</Text>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.miniBtnRed}
                  onPress={downloadToolsPdf}
                  disabled={!!downloading}
                >
                  <Text style={styles.miniBtnRedText}>⬇ PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.miniBtnGreen}
                  onPress={downloadToolsExcel}
                  disabled={!!downloading}
                >
                  <Text style={styles.miniBtnGreenText}>⬇ Excel</Text>
                </TouchableOpacity>
                <DropdownPicker
                  label="Top N"
                  value={toolLimit}
                  options={TOP_N_OPTIONS}
                  onSelect={setToolLimit}
                />
              </View>
            </View>
            <Text style={styles.countText}>
              {displayTools.length} / {summary.tools.length}
            </Text>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.thCell, { width: 40 }]}>#</Text>
              <Text style={[styles.thCell, { flex: 1 }]}>Tool</Text>
              <Text style={[styles.thCell, { width: 70, textAlign: "right" }]}>Rented</Text>
              <Text style={[styles.thCell, { width: 100, textAlign: "right" }]}>Revenue</Text>
            </View>
            {displayTools.length === 0 ? (
              <Text style={styles.emptyText}>No data for this period</Text>
            ) : (
              displayTools.map((t, i) => (
                <View key={t.name + i} style={styles.tableRow}>
                  <Text style={[styles.tdCell, { width: 40, color: "#714B67", fontWeight: "700" }]}>
                    {i + 1}
                  </Text>
                  <Text style={[styles.tdCell, { flex: 1, fontWeight: "600" }]} numberOfLines={1}>
                    {t.name}
                  </Text>
                  <Text style={[styles.tdCell, { width: 70, textAlign: "right" }]}>
                    {formatNumber(t.qty)}
                  </Text>
                  <Text
                    style={[
                      styles.tdCell,
                      { width: 100, textAlign: "right", color: "#28A745", fontWeight: "700" },
                    ]}
                  >
                    {formatMoney(t.revenue)}
                  </Text>
                </View>
              ))
            )}
          </View>

          {downloading ? (
            <View style={styles.savingOverlay}>
              <ActivityIndicator size="large" color="#714B67" />
              <Text style={{ marginTop: 8, color: "#666" }}>Generating file...</Text>
            </View>
          ) : null}
        </ScrollView>
      </RoundedContainer>
    </SafeAreaView>
  );
};

const calStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  navBtn: { paddingHorizontal: 16, paddingVertical: 6 },
  navBtnText: { fontSize: 16, color: "#714B67", fontWeight: "700" },
  navBtnDisabled: { color: "#ccc" },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerPick: { flexDirection: "row", alignItems: "center", gap: 3 },
  monthName: { fontSize: 16, fontWeight: "700", color: "#714B67" },
  yearLabel: { fontSize: 16, fontWeight: "700", color: "#714B67" },
  headerArrow: { fontSize: 11, color: "#714B67", fontWeight: "700" },
  pickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 4,
  },
  pickCell: {
    width: "30%",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f7f7f7",
    borderRadius: 8,
  },
  pickCellSelected: { backgroundColor: "#714B67" },
  pickCellDisabled: { backgroundColor: "#fff" },
  pickText: { fontSize: 14, fontWeight: "600", color: "#333" },
  pickTextSelected: { color: "#fff" },
  pickTextDisabled: { color: "#ccc" },
  weekRow: { flexDirection: "row", gap: 2, marginBottom: 2 },
  dayNameCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    backgroundColor: "#714B67",
    borderRadius: 4,
  },
  dayNameText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  emptyCell: { flex: 1, aspectRatio: 1 },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f7f7f7",
    borderRadius: 6,
  },
  dayCellSelected: { backgroundColor: "#714B67" },
  dayCellDisabled: { backgroundColor: "#fff" },
  dayNum: { fontSize: 13, fontWeight: "600", color: "#333" },
  dayNumSelected: { color: "#fff" },
  dayNumDisabled: { color: "#ccc" },
});

const dropStyles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  triggerText: { fontSize: 12, color: "#333", fontWeight: "500", flex: 1 },
  arrow: { fontSize: 8, color: "#888", marginLeft: 4 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  menu: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 8,
    width: 240,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#888",
    paddingHorizontal: 12,
    paddingVertical: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  menuItem: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  menuItemActive: { backgroundColor: "#714B6715" },
  menuItemText: { fontSize: 14, color: "#333" },
  menuItemTextActive: { color: "#714B67", fontWeight: "600" },
});

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    flexWrap: "wrap",
    gap: 8,
  },
  headerSubtitle: { fontSize: 13, color: "#666", fontWeight: "600" },
  headerActions: { flexDirection: "row", gap: 6 },
  headerBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  headerBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  pillBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  pillActive: { backgroundColor: "#714B67", borderColor: "#714B67" },
  pillActiveDark: { backgroundColor: "#4A2F44", borderColor: "#4A2F44" },
  pillText: { fontSize: 12, color: "#555", fontWeight: "600" },
  pillTextActive: { color: "#fff" },

  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  customLabel: { fontSize: 12, color: "#666", fontWeight: "600" },
  toLabel: { fontSize: 12, color: "#666" },
  dateInput: {
    flex: 1,
    minWidth: 120,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: "#fff",
  },
  dateInputIcon: { fontSize: 13 },
  dateInputText: { fontSize: 12, color: "#222", flex: 1 },
  dateInputPlaceholder: { fontSize: 12, color: "#999", flex: 1 },
  dateInputClear: { fontSize: 13, color: "#999", fontWeight: "700", paddingLeft: 2 },

  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  kpiCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  kpiLabel: {
    fontSize: 10,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  kpiValue: { fontSize: 18, fontWeight: "800" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4,
  },
  cardTitle: { fontSize: 14, fontWeight: "800", color: "#333" },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  miniBtnRed: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#DC3545",
    borderRadius: 6,
  },
  miniBtnRedText: { fontSize: 11, color: "#DC3545", fontWeight: "700" },
  miniBtnGreen: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#28A745",
    borderRadius: 6,
  },
  miniBtnGreenText: { fontSize: 11, color: "#28A745", fontWeight: "700" },
  countText: { fontSize: 11, color: "#888", marginBottom: 6, marginTop: 2 },

  tableHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    backgroundColor: "#f5f5f5",
    borderRadius: 6,
  },
  thCell: { fontSize: 11, fontWeight: "800", color: "#666", textTransform: "uppercase" },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  tdCell: { fontSize: 12, color: "#333" },
  emptyText: {
    textAlign: "center",
    color: "#999",
    fontStyle: "italic",
    paddingVertical: 18,
    fontSize: 12,
  },

  savingOverlay: {
    alignItems: "center",
    paddingVertical: 16,
  },
});

export default SalesReportScreen;
