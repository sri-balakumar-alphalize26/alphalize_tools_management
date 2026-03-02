import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Image,
} from "react-native";
import { SafeAreaView, RoundedContainer } from "@components/containers";
import NavigationHeader from "@components/Header/NavigationHeader";
import { TextInput } from "@components/common/TextInput";
import { Button } from "@components/common/Button";
import { COLORS, SPACING, BORDER_RADIUS } from "@constants/theme";
import { showToastMessage } from "@components/Toast";
import useToolStore from "@stores/toolManagement/useToolStore";
import useAuthStore from "@stores/auth/useAuthStore";
import * as DocumentPicker from "expo-document-picker";
import SignaturePad from "@components/common/SignaturePad/SignaturePad";
import CameraCapture from "@components/common/CameraCapture/CameraCapture";

const PERIOD_TYPES = [
  { label: "Daily", value: "day" },
  { label: "Weekly", value: "week" },
  { label: "Monthly", value: "month" },
];

const CONDITIONS = [
  { label: "Excellent", value: "excellent" },
  { label: "Good", value: "good" },
  { label: "Fair", value: "fair" },
  { label: "Poor", value: "poor" },
  { label: "Damaged", value: "damaged" },
];

const STATE_STEPS = [
  { key: "draft", label: "Draft" },
  { key: "confirmed", label: "Confirmed" },
  { key: "checked_out", label: "Checked Out" },
  { key: "checked_in", label: "Checked In" },
  { key: "invoiced", label: "Invoiced" },
];

const STATE_ORDER = ["draft", "confirmed", "checked_out", "checked_in", "done", "invoiced"];

const today = () => {
  const d = new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[d.getMonth()] + " " + d.getDate();
};
const todayISO = () => new Date().toISOString().split("T")[0];

const RentalOrderFormScreen = ({ navigation, route }) => {
  const existingOrder = route?.params?.order;
  const odooAuth = useAuthStore((s) => s.odooAuth);
  const customers = useToolStore((s) => s.customers);
  const tools = useToolStore((s) => s.tools);
  const addOrder = useToolStore((s) => s.addOrder);
  const updateOrder = useToolStore((s) => s.updateOrder);
  const storeConfirmOrder = useToolStore((s) => s.confirmOrder);
  const storeCancelOrder = useToolStore((s) => s.cancelOrder);
  const storeMarkDone = useToolStore((s) => s.markDone);
  const storeCreateInvoice = useToolStore((s) => s.createInvoice);
  const [saving, setSaving] = useState(false);

  const [state, setState] = useState(existingOrder?.state || "draft");
  const [form, setForm] = useState({
    name: existingOrder?.name || "New",
    customer_id: existingOrder?.customer_id || "",
    partner_name: existingOrder?.partner_name || "",
    partner_phone: existingOrder?.partner_phone || "",
    partner_email: existingOrder?.partner_email || "",
    responsible: existingOrder?.responsible || "Admin",
    date_order: existingOrder?.date_order || today(),
    date_planned_checkout: existingOrder?.date_planned_checkout || "",
    date_planned_checkin: existingOrder?.date_planned_checkin || "",
    date_checkout: existingOrder?.date_checkout || "",
    date_checkin: existingOrder?.date_checkin || "",
    rental_period_type: existingOrder?.rental_period_type || "day",
    rental_duration: existingOrder?.rental_duration?.toString() || "1",
    actual_duration: existingOrder?.actual_duration || "",
    deposit_amount: existingOrder?.deposit_amount?.toString() || "0.00",
    deposit_returned: existingOrder?.deposit_returned || false,
    damage_charges: existingOrder?.damage_charges?.toString() || "0",
    discount_amount: existingOrder?.discount_amount?.toString() || "0",
    notes: existingOrder?.notes || "",
    terms: existingOrder?.terms || "",
  });

  const [lines, setLines] = useState(existingOrder?.lines || []);
  const [timesheet, setTimesheet] = useState(existingOrder?.timesheet || []);
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState("lines");
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [checkoutIdProof, setCheckoutIdProof] = useState(false);
  const [idProofUri, setIdProofUri] = useState(null);
  const [toolPhotoUris, setToolPhotoUris] = useState({});
  const [checkoutSignature, setCheckoutSignature] = useState(false);
  const [checkoutSignatureUri, setCheckoutSignatureUri] = useState(null);
  const [checkinSignatureUri, setCheckinSignatureUri] = useState(null);
  const [checkinAuthoritySignatureUri, setCheckinAuthoritySignatureUri] = useState(null);
  const [checkinReturnDeposit, setCheckinReturnDeposit] = useState(false);
  const [checkinSignature, setCheckinSignature] = useState(false);
  const [checkinAuthoritySignature, setCheckinAuthoritySignature] = useState(false);
  const [checkinSignerName, setCheckinSignerName] = useState("");
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [activeSignatureTarget, setActiveSignatureTarget] = useState(null);
  const signatureRef = useRef(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraCallback, setCameraCallback] = useState(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [activeToolLineIdx, setActiveToolLineIdx] = useState(-1);

  const PERIOD_DURATION_MAP = { day: "1", week: "7", month: "30" };

  const handleChange = (field, value) => {
    if (field === "rental_period_type") {
      const newDuration = PERIOD_DURATION_MAP[value] || "1";
      setForm((prev) => ({ ...prev, rental_period_type: value, rental_duration: newDuration }));
      setLines((prev) => prev.map((l) => ({ ...l, planned_duration: newDuration })));
      setErrors((prev) => ({ ...prev, rental_period_type: null }));
      return;
    }
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  };

  // ---------- CUSTOMER AUTOCOMPLETE ----------
  const filteredCustomers =
    showCustomerDropdown && form.partner_name.trim().length > 0
      ? customers.filter((c) =>
          c.name.toLowerCase().includes(form.partner_name.toLowerCase())
        ).slice(0, 10)
      : [];

  const selectCustomer = (customer) => {
    setForm((prev) => ({
      ...prev,
      partner_name: customer.name,
      partner_phone: customer.phone || "",
      partner_email: customer.email || "",
      partner_id: customer.odoo_id || parseInt(customer.id) || null,
    }));
    setShowCustomerDropdown(false);
  };

  const clearCustomer = () => {
    setForm((prev) => ({
      ...prev,
      partner_name: "",
      partner_phone: "",
      partner_email: "",
      partner_id: null,
    }));
    setShowCustomerDropdown(false);
  };

  // ---------- TOOL AUTOCOMPLETE ----------
  const getFilteredTools = (searchText) => {
    if (!searchText || searchText.trim().length === 0) return [];
    return tools
      .filter(
        (t) =>
          t.name.toLowerCase().includes(searchText.toLowerCase()) ||
          (t.serial_number &&
            t.serial_number.toLowerCase().includes(searchText.toLowerCase())) ||
          (t.code && t.code.toLowerCase().includes(searchText.toLowerCase()))
      )
      .slice(0, 10);
  };

  const selectTool = (index, tool) => {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        tool_name: tool.name,
        tool_id: tool.odoo_id || parseInt(tool.id) || null,
        serial_number: tool.serial_number || "",
        unit_price: tool.rental_price_per_day || "0",
      };
      const price = parseFloat(updated[index].unit_price) || 0;
      const dur = parseFloat(updated[index].planned_duration) || 1;
      const qty = parseFloat(updated[index].quantity) || 1;
      updated[index].line_total = (price * dur * qty).toFixed(2);
      return updated;
    });
    setActiveToolLineIdx(-1);
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        tool_name: "",
        serial_number: "",
        pricing_rule: "",
        unit_price: "",
        quantity: "1",
        period_type: "day",
        planned_duration: form.rental_duration,
        actual_duration: "",
        extra_days: "0",
        returned_qty: "0",
        checkout_condition: "",
        checkin_condition: "",
        checkout_tool_image: false,
        damage_note: "",
        damage_charge: "0",
        late_fee_per_day: "0",
        late_fee_amount: "0",
        discount_type: "",
        discount_value: "0",
        notes: "",
      },
    ]);
  };

  const updateLine = (index, field, value) => {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (["unit_price", "planned_duration", "quantity"].includes(field)) {
        const l = updated[index];
        const price = parseFloat(l.unit_price) || 0;
        const dur = parseFloat(l.planned_duration) || 1;
        const qty = parseFloat(l.quantity) || 1;
        updated[index].line_total = (price * dur * qty).toFixed(2);
      }
      return updated;
    });
  };

  const removeLine = (index) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const addTimesheetEntry = (action, notes) => {
    setTimesheet((prev) => [
      ...prev,
      { id: Date.now().toString(), date: todayISO(), time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), action, notes, user: "Admin" },
    ]);
  };

  // ---------- CALCULATIONS ----------
  const calcLineTotal = (l) => {
    const price = parseFloat(l.unit_price) || 0;
    const dur = parseFloat(l.planned_duration) || 1;
    const qty = parseFloat(l.quantity) || 1;
    return price * dur * qty;
  };

  const calcSubtotal = () => lines.reduce((sum, l) => sum + calcLineTotal(l), 0);
  const calcLateFees = () => lines.reduce((sum, l) => sum + (parseFloat(l.late_fee_amount) || 0), 0);
  const calcDamageCharges = () => lines.reduce((sum, l) => sum + (parseFloat(l.damage_charge) || 0), 0);
  const calcTotal = () => calcSubtotal() + calcLateFees() + calcDamageCharges() - (parseFloat(form.discount_amount) || 0);

  // ---------- WORKFLOW ACTIONS ----------
  const validateOrder = () => {
    const newErrors = {};
    if (!form.partner_name.trim()) newErrors.partner_name = "Customer is required";
    if (lines.length === 0) newErrors.lines = "Add at least one rental line";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const actionConfirm = async () => {
    if (!validateOrder()) return;
    setSaving(true);
    try {
      if (existingOrder?.odoo_id && odooAuth) {
        await storeConfirmOrder(odooAuth, existingOrder.odoo_id);
        showToastMessage("Order confirmed in Odoo");
        savedRef.current = true;
        navigation.goBack();
        return;
      }
      // No existing order in Odoo — create it first, then confirm
      if (odooAuth) {
        const orderValues = {
          partner_id: form.partner_id || null,
          date_planned_checkout: form.date_planned_checkout || false,
          date_planned_checkin: form.date_planned_checkin || false,
          rental_period_type: form.rental_period_type,
          rental_duration: parseFloat(form.rental_duration) || 1,
          deposit_amount: parseFloat(form.deposit_amount) || 0,
          notes: form.notes || "",
          terms: form.terms || "",
        };
        const lineValues = lines.map((l) => ({
          tool_id: l.tool_id || null,
          unit_price: parseFloat(l.unit_price) || 0,
          quantity: parseFloat(l.quantity) || 1,
          planned_duration: parseFloat(l.planned_duration) || 1,
          period_type: l.period_type || form.rental_period_type,
        }));
        const newId = await addOrder(odooAuth, orderValues, lineValues);
        await storeConfirmOrder(odooAuth, newId);
        showToastMessage("Order created and confirmed in Odoo");
        savedRef.current = true;
        navigation.goBack();
        return;
      }
      // Offline fallback
      const orderName = "RNT/" + new Date().getFullYear().toString().slice(2) + "/" + String(Math.floor(Math.random() * 99999)).padStart(5, "0");
      const custId = "CUS/" + String(Math.floor(Math.random() * 9999)).padStart(4, "0");
      setState("confirmed");
      setForm((prev) => ({ ...prev, name: orderName, customer_id: custId }));
      addTimesheetEntry("note", "Rental Order created");
      addTimesheetEntry("note", "Draft \u2192 Confirmed (Status)");
      showToastMessage("Order confirmed");
    } catch (e) {
      showToastMessage("Confirm failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const openCheckoutWizard = () => {
    setShowCheckoutModal(true);
  };

  const confirmCheckout = () => {
    const missing = lines.find((l) => !l.checkout_condition);
    if (missing) {
      Alert.alert("Required", "Set condition for all tools before check-out");
      return;
    }
    if (!checkoutIdProof) {
      Alert.alert("Required", "ID Proof is mandatory for check-out");
      return;
    }
    setShowCheckoutModal(false);
    setState("checked_out");
    setForm((prev) => ({ ...prev, date_checkout: today(), actual_duration: form.rental_duration + " Day" }));
    addTimesheetEntry("checkout", "None \u2192 " + today() + " (Actual Check-Out)");
    addTimesheetEntry("note", "Confirmed \u2192 Checked Out (Status)");
    showToastMessage("Check-out completed");
  };

  const openCheckinWizard = () => {
    setShowCheckinModal(true);
  };

  const confirmCheckin = () => {
    const missing = lines.find((l) => !l.checkin_condition);
    if (missing) {
      Alert.alert("Required", "Set condition for all tools before check-in");
      return;
    }
    setShowCheckinModal(false);
    setState("checked_in");
    setForm((prev) => ({
      ...prev,
      date_checkin: today(),
      deposit_returned: checkinReturnDeposit,
    }));
    setLines((prev) => prev.map((l) => ({ ...l, returned_qty: l.quantity })));
    addTimesheetEntry("checkin", "Tools returned by " + form.partner_name);
    addTimesheetEntry("note", "Checked Out \u2192 Checked In (Status)");
    showToastMessage("Check-in completed");
  };

  const actionDone = async () => {
    setSaving(true);
    try {
      if (existingOrder?.odoo_id && odooAuth) {
        await storeMarkDone(odooAuth, existingOrder.odoo_id);
        showToastMessage("Marked as done in Odoo");
        navigation.goBack();
        return;
      }
      setState("done");
      addTimesheetEntry("note", "Checked In \u2192 Done (Status)");
      showToastMessage("Order marked as done");
    } catch (e) {
      showToastMessage("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const actionInvoice = async () => {
    setSaving(true);
    try {
      if (existingOrder?.odoo_id && odooAuth) {
        await storeCreateInvoice(odooAuth, existingOrder.odoo_id);
        showToastMessage("Invoice created in Odoo");
        navigation.goBack();
        return;
      }
      setState("invoiced");
      addTimesheetEntry("payment", "Invoice created. Total: $" + calcTotal().toFixed(2));
      addTimesheetEntry("note", "Done \u2192 Invoiced (Status)");
      showToastMessage("Invoice created");
    } catch (e) {
      showToastMessage("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const actionCancel = () => {
    Alert.alert("Cancel Order", "Are you sure you want to cancel this order?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          setSaving(true);
          try {
            if (existingOrder?.odoo_id && odooAuth) {
              await storeCancelOrder(odooAuth, existingOrder.odoo_id);
              showToastMessage("Order cancelled in Odoo");
              navigation.goBack();
              return;
            }
            setState("cancelled");
            addTimesheetEntry("note", "Order cancelled");
            showToastMessage("Order cancelled");
          } catch (e) {
            showToastMessage("Error: " + e.message);
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!validateOrder()) return;
    setSaving(true);
    try {
      const orderValues = {
        partner_id: form.partner_id || null,
        date_planned_checkout: form.date_planned_checkout || false,
        date_planned_checkin: form.date_planned_checkin || false,
        rental_period_type: form.rental_period_type,
        rental_duration: parseFloat(form.rental_duration) || 1,
        deposit_amount: parseFloat(form.deposit_amount) || 0,
        notes: form.notes || "",
        terms: form.terms || "",
      };
      const lineValues = lines.map((l) => ({
        tool_id: l.tool_id || null,
        unit_price: parseFloat(l.unit_price) || 0,
        quantity: parseFloat(l.quantity) || 1,
        planned_duration: parseFloat(l.planned_duration) || 1,
        period_type: l.period_type || form.rental_period_type,
      }));

      if (existingOrder?.odoo_id && odooAuth) {
        await updateOrder(odooAuth, existingOrder.odoo_id, orderValues);
        showToastMessage("Order updated in Odoo");
      } else if (odooAuth) {
        await addOrder(odooAuth, orderValues, lineValues);
        showToastMessage("Order created in Odoo");
      } else {
        showToastMessage("Order saved locally");
      }
      savedRef.current = true;
      navigation.goBack();
    } catch (e) {
      showToastMessage("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // ---------- AUTO-SAVE ON LEAVE ----------
  const savedRef = useRef(false);
  const formRef = useRef(form);
  const linesRef = useRef(lines);
  formRef.current = form;
  linesRef.current = lines;

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (savedRef.current) return;
      const curForm = formRef.current;
      const curLines = linesRef.current;
      if (!curForm.partner_name.trim() || curLines.length === 0) return;
      if (!odooAuth || existingOrder?.odoo_id) return;

      e.preventDefault();
      savedRef.current = true;

      const orderValues = {
        partner_id: curForm.partner_id || null,
        date_planned_checkout: curForm.date_planned_checkout || false,
        date_planned_checkin: curForm.date_planned_checkin || false,
        rental_period_type: curForm.rental_period_type,
        rental_duration: parseFloat(curForm.rental_duration) || 1,
        deposit_amount: parseFloat(curForm.deposit_amount) || 0,
        notes: curForm.notes || "",
        terms: curForm.terms || "",
      };
      const lineValues = curLines.map((l) => ({
        tool_id: l.tool_id || null,
        unit_price: parseFloat(l.unit_price) || 0,
        quantity: parseFloat(l.quantity) || 1,
        planned_duration: parseFloat(l.planned_duration) || 1,
        period_type: l.period_type || curForm.rental_period_type,
      }));

      addOrder(odooAuth, orderValues, lineValues)
        .then(() => showToastMessage("Order auto-saved as draft"))
        .catch(() => {})
        .finally(() => navigation.dispatch(e.data.action));
    });
    return unsubscribe;
  }, [navigation, odooAuth, existingOrder, addOrder]);

  // ---------- HELPER ----------
  const stateIdx = STATE_ORDER.indexOf(state);
  const isEditable = state === "draft";
  const periodLabel = PERIOD_TYPES.find((p) => p.value === form.rental_period_type)?.label || "Daily";

  // ---------- CAMERA & FILE PICKER ----------
  const openCamera = (callback) => {
    setCameraCallback(() => callback);
    setShowCamera(true);
  };

  const handleCameraCapture = (uri) => {
    setShowCamera(false);
    if (cameraCallback) {
      cameraCallback(uri);
      setCameraCallback(null);
    }
  };

  const openCameraForIdProof = () => {
    openCamera((uri) => {
      setIdProofUri(uri);
      setCheckoutIdProof(true);
      showToastMessage("ID Proof captured");
    });
  };

  const pickFileForIdProof = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        setIdProofUri(result.assets[0].uri);
        setCheckoutIdProof(true);
        showToastMessage("ID Proof file attached");
      }
    } catch (e) {
      Alert.alert("Error", "Could not pick file: " + e.message);
    }
  };

  const removeIdProof = () => {
    setIdProofUri(null);
    setCheckoutIdProof(false);
  };

  const openCameraForToolPhoto = (lineIdx) => {
    openCamera((uri) => {
      setToolPhotoUris((prev) => ({ ...prev, [lineIdx]: uri }));
      updateLine(lineIdx, "checkout_tool_image", true);
      showToastMessage("Tool photo captured");
    });
  };

  const removeToolPhoto = (lineIdx) => {
    setToolPhotoUris((prev) => {
      const updated = { ...prev };
      delete updated[lineIdx];
      return updated;
    });
    updateLine(lineIdx, "checkout_tool_image", false);
  };

  // ---------- SIGNATURE PAD ----------
  const openSignaturePad = (target) => {
    setActiveSignatureTarget(target);
    setShowSignaturePad(true);
  };

  const handleSignatureSave = async () => {
    if (!activeSignatureTarget) return;
    if (signatureRef.current?.isEmpty()) {
      Alert.alert("Required", "Please draw your signature first.");
      return;
    }
    try {
      const uri = await signatureRef.current.readSignature();
      if (uri) {
        const { setUri, setFlag } = activeSignatureTarget;
        setUri(uri);
        setFlag(true);
        setShowSignaturePad(false);
        setActiveSignatureTarget(null);
        showToastMessage("Signature saved");
      }
    } catch (e) {
      Alert.alert("Error", "Could not save signature");
    }
  };

  const handleSignatureClear = () => {
    if (signatureRef.current) signatureRef.current.clearSignature();
  };

  const removeSignature = (setUri, setFlag) => {
    setUri(null);
    setFlag(false);
  };

  // ---------- STATUS BREADCRUMB ----------
  const renderStatusBreadcrumb = () => (
    <View style={styles.breadcrumbRow}>
      {STATE_STEPS.map((step, idx) => {
        const stepIdx = STATE_ORDER.indexOf(step.key);
        const isActive = state === step.key;
        const isPast = stateIdx > stepIdx;
        return (
          <View key={step.key} style={styles.breadcrumbItem}>
            <View style={[styles.breadcrumbDot, isActive && styles.breadcrumbDotActive, isPast && styles.breadcrumbDotPast]} />
            <Text style={[styles.breadcrumbLabel, isActive && styles.breadcrumbLabelActive, isPast && styles.breadcrumbLabelPast]}>
              {step.label}
            </Text>
            {idx < STATE_STEPS.length - 1 && <View style={[styles.breadcrumbLine, isPast && styles.breadcrumbLinePast]} />}
          </View>
        );
      })}
    </View>
  );

  // ---------- ACTION BUTTONS ----------
  const renderActionButtons = () => {
    if (state === "cancelled") return null;
    return (
      <View style={styles.actionRow}>
        {state === "draft" && (
          <>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.primaryThemeColor }]} onPress={actionConfirm}>
              <Text style={styles.actionBtnText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelActionBtn} onPress={actionCancel}>
              <Text style={styles.cancelActionBtnText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
        {state === "confirmed" && (
          <>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#FF9800" }]} onPress={openCheckoutWizard}>
              <Text style={styles.actionBtnText}>Check-Out Tools</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelActionBtn} onPress={actionCancel}>
              <Text style={styles.cancelActionBtnText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
        {state === "checked_out" && (
          <>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#E65100" }]} onPress={() => Alert.alert("Discount", "Discount feature")}>
              <Text style={styles.actionBtnText}>Discount</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#4CAF50" }]} onPress={openCheckinWizard}>
              <Text style={styles.actionBtnText}>Check-In Tools</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelActionBtn} onPress={actionCancel}>
              <Text style={styles.cancelActionBtnText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
        {state === "checked_in" && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#388E3C" }]} onPress={actionDone}>
            <Text style={styles.actionBtnText}>Mark Done</Text>
          </TouchableOpacity>
        )}
        {state === "done" && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#7B1FA2" }]} onPress={actionInvoice}>
            <Text style={styles.actionBtnText}>Create Invoice</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ---------- CONDITION CHIPS ----------
  const renderConditionChips = (value, onSelect, disabled) => (
    <View style={styles.chipRow}>
      {CONDITIONS.map((c) => (
        <TouchableOpacity
          key={c.value}
          style={[styles.condChip, value === c.value && styles.condChipActive]}
          onPress={() => !disabled && onSelect(c.value)}
          disabled={disabled}
        >
          <Text style={[styles.condChipText, value === c.value && styles.condChipTextActive]}>
            {c.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ---------- TABS ----------
  const getTabs = () => {
    const tabs = [
      { key: "lines", label: "Rental Lines" },
      { key: "timesheet", label: "Timesheet" },
    ];
    if (state === "checked_out" || state === "checked_in" || state === "done" || state === "invoiced") {
      tabs.push({ key: "checkout_details", label: "Details" });
    }
    tabs.push({ key: "notes", label: "Notes" });
    return tabs;
  };

  // ---------- CHECK-OUT MODAL ----------
  const renderCheckoutModal = () => (
    <Modal visible={showCheckoutModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Check-Out Tools</Text>
              <TouchableOpacity onPress={() => setShowCheckoutModal(false)}>
                <Text style={styles.modalClose}>X</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalInfoRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Rental Order</Text>
                <Text style={styles.modalValue}>{form.name}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Check-Out Date</Text>
                <Text style={styles.modalValue}>{today()}</Text>
              </View>
            </View>
            <View style={styles.modalInfoRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Customer</Text>
                <Text style={styles.modalValue}>{form.partner_name}</Text>
              </View>
            </View>

            <Text style={styles.modalSection}>TOOLS</Text>
            {lines.map((line, idx) => (
              <View key={line.id} style={styles.modalToolCard}>
                <View style={styles.modalToolRow}>
                  <Text style={styles.modalToolName}>{line.tool_name || "Tool " + (idx + 1)}</Text>
                  <Text style={styles.modalToolSerial}>S/N: {line.serial_number || "-"}</Text>
                </View>
                <View style={styles.modalToolRow}>
                  <Text style={styles.modalToolDetail}>${line.unit_price || "0.00"}/Day</Text>
                  <Text style={styles.modalToolDetail}>Duration: {line.planned_duration || "1"}</Text>
                  <Text style={styles.modalToolTotal}>${calcLineTotal(line).toFixed(2)}</Text>
                </View>
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.modalFieldLabel}>Condition *</Text>
                  {renderConditionChips(line.checkout_condition, (v) => updateLine(idx, "checkout_condition", v))}
                </View>
                {toolPhotoUris[idx] ? (
                  <View style={styles.capturedImageWrap}>
                    <Image source={{ uri: toolPhotoUris[idx] }} style={styles.capturedImage} />
                    <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => removeToolPhoto(idx)}>
                      <Text style={styles.photoRemoveBtnText}>X</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.photoBtn}
                    onPress={() => openCameraForToolPhoto(idx)}
                  >
                    <Text style={styles.photoBtnText}>Capture Tool Photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            <Text style={styles.modalSection}>ID PROOF (REQUIRED)</Text>
            {idProofUri ? (
              <View style={styles.capturedImageWrap}>
                <Image source={{ uri: idProofUri }} style={styles.capturedIdProof} />
                <TouchableOpacity style={styles.photoRemoveBtn} onPress={removeIdProof}>
                  <Text style={styles.photoRemoveBtnText}>X</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.idProofRow}>
                <TouchableOpacity style={styles.idProofBtn} onPress={openCameraForIdProof}>
                  <Text style={styles.idProofBtnText}>Open Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.idProofBtn} onPress={pickFileForIdProof}>
                  <Text style={styles.idProofBtnText}>Attach File</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.modalSection}>CUSTOMER SIGNATURE</Text>
            {checkoutSignatureUri ? (
              <View style={styles.capturedImageWrap}>
                <Image source={{ uri: checkoutSignatureUri }} style={styles.capturedSignature} />
                <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => removeSignature(setCheckoutSignatureUri, setCheckoutSignature)}>
                  <Text style={styles.photoRemoveBtnText}>X</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.signBox}
                onPress={() => openSignaturePad({ setUri: setCheckoutSignatureUri, setFlag: setCheckoutSignature })}
              >
                <Text style={styles.signBoxText}>Tap to draw customer signature</Text>
              </TouchableOpacity>
            )}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#4CAF50" }]} onPress={confirmCheckout}>
                <Text style={styles.modalBtnText}>Confirm Check-Out</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#9E9E9E" }]} onPress={() => setShowCheckoutModal(false)}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ---------- CHECK-IN MODAL ----------
  const renderCheckinModal = () => (
    <Modal visible={showCheckinModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Check-In Tools</Text>
              <TouchableOpacity onPress={() => setShowCheckinModal(false)}>
                <Text style={styles.modalClose}>X</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalInfoRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Rental Order</Text>
                <Text style={styles.modalValue}>{form.name}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Check-Out Date</Text>
                <Text style={styles.modalValue}>{form.date_checkout}</Text>
              </View>
            </View>
            <View style={styles.modalInfoRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Customer</Text>
                <Text style={styles.modalValue}>{form.partner_name}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Check-In Date</Text>
                <Text style={[styles.modalValue, { fontWeight: "700" }]}>{today()}</Text>
              </View>
            </View>
            <View style={styles.modalInfoRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Duration</Text>
                <Text style={styles.modalValue}>{form.rental_duration} Day</Text>
              </View>
              <View style={{ flex: 1 }}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setCheckinReturnDeposit(!checkinReturnDeposit)}
                >
                  <View style={[styles.checkbox, checkinReturnDeposit && styles.checkboxChecked]}>
                    {checkinReturnDeposit && <Text style={styles.checkMark}>{"\u2713"}</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>Return Deposit?</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.modalSection}>TOOLS</Text>
            {lines.map((line, idx) => (
              <View key={line.id} style={styles.modalToolCard}>
                <View style={styles.modalToolRow}>
                  <Text style={styles.modalToolName}>{line.tool_name || "Tool " + (idx + 1)}</Text>
                  <Text style={styles.modalToolSerial}>S/N: {line.serial_number || "-"}</Text>
                </View>
                <View style={styles.modalToolRow}>
                  <Text style={styles.modalToolDetail}>Duration: {line.planned_duration || "1"} Day</Text>
                  <Text style={styles.modalToolDetail}>Extra: {line.extra_days || "0"} Days</Text>
                </View>

                <View style={{ marginTop: 8 }}>
                  <Text style={styles.modalFieldLabel}>Return Condition *</Text>
                  {renderConditionChips(line.checkin_condition, (v) => updateLine(idx, "checkin_condition", v))}
                </View>

                <View style={styles.modalToolRow2}>
                  <View style={{ flex: 1, marginRight: 6 }}>
                    <Text style={styles.modalFieldLabel}>Late Fee/Day</Text>
                    <TextInput placeholder="0.00" value={line.late_fee_per_day} onChangeText={(t) => updateLine(idx, "late_fee_per_day", t)} keyboardType="decimal-pad" column />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalFieldLabel}>Late Fee</Text>
                    <TextInput placeholder="0.00" value={line.late_fee_amount} onChangeText={(t) => updateLine(idx, "late_fee_amount", t)} keyboardType="decimal-pad" column />
                  </View>
                </View>
                <View style={styles.modalToolRow2}>
                  <View style={{ flex: 1, marginRight: 6 }}>
                    <Text style={styles.modalFieldLabel}>Damage Note</Text>
                    <TextInput placeholder="Describe damage..." value={line.damage_note} onChangeText={(t) => updateLine(idx, "damage_note", t)} column />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalFieldLabel}>Damage Charge</Text>
                    <TextInput placeholder="0.00" value={line.damage_charge} onChangeText={(t) => updateLine(idx, "damage_charge", t)} keyboardType="decimal-pad" column />
                  </View>
                </View>
              </View>
            ))}

            <View style={styles.totalDamageRow}>
              <Text style={styles.totalDamageLabel}>Total Damage Charges</Text>
              <Text style={styles.totalDamageValue}>${calcDamageCharges().toFixed(2)}</Text>
            </View>

            <Text style={styles.modalSection}>CUSTOMER SIGNATURE</Text>
            {checkinSignatureUri ? (
              <View style={styles.capturedImageWrap}>
                <Image source={{ uri: checkinSignatureUri }} style={styles.capturedSignature} />
                <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => removeSignature(setCheckinSignatureUri, setCheckinSignature)}>
                  <Text style={styles.photoRemoveBtnText}>X</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.signBox}
                onPress={() => openSignaturePad({ setUri: setCheckinSignatureUri, setFlag: setCheckinSignature })}
              >
                <Text style={styles.signBoxText}>Tap to draw customer signature</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.modalSection}>AUTHORITY SIGNATURE</Text>
            <TextInput label="Signer Name" placeholder="Authority name" value={checkinSignerName} onChangeText={setCheckinSignerName} column />
            {checkinAuthoritySignatureUri ? (
              <View style={styles.capturedImageWrap}>
                <Image source={{ uri: checkinAuthoritySignatureUri }} style={styles.capturedSignature} />
                <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => removeSignature(setCheckinAuthoritySignatureUri, setCheckinAuthoritySignature)}>
                  <Text style={styles.photoRemoveBtnText}>X</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.signBox}
                onPress={() => openSignaturePad({ setUri: setCheckinAuthoritySignatureUri, setFlag: setCheckinAuthoritySignature })}
              >
                <Text style={styles.signBoxText}>Tap to draw authority signature</Text>
              </TouchableOpacity>
            )}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#4CAF50" }]} onPress={confirmCheckin}>
                <Text style={styles.modalBtnText}>Confirm Check-In</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#9E9E9E" }]} onPress={() => setShowCheckinModal(false)}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ========== MAIN RENDER ==========
  return (
    <SafeAreaView>
      <NavigationHeader
        title={form.name === "New" ? "New Rental Order" : form.name}
        navigation={navigation}
      />
      <RoundedContainer>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ACTION BUTTONS */}
          {renderActionButtons()}

          {/* STATUS BREADCRUMB */}
          {renderStatusBreadcrumb()}

          {/* ========= CUSTOMER SECTION ========= */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionCardTitle}>CUSTOMER</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Customer *</Text>
              {form.partner_id && !showCustomerDropdown ? (
                <View style={styles.selectedCustomerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedCustomerName}>{form.partner_name}</Text>
                    {form.partner_phone ? <Text style={styles.selectedCustomerSub}>{form.partner_phone}</Text> : null}
                  </View>
                  {isEditable && (
                    <TouchableOpacity onPress={clearCustomer} style={styles.clearBtn}>
                      <Text style={styles.clearBtnText}>X</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <TextInput
                  placeholder="Search customer..."
                  value={form.partner_name}
                  onChangeText={(t) => {
                    handleChange("partner_name", t);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => form.partner_name.length > 0 && setShowCustomerDropdown(true)}
                  editable={isEditable}
                  column
                />
              )}
              {errors.partner_name && <Text style={styles.errorText}>{errors.partner_name}</Text>}
              {showCustomerDropdown && filteredCustomers.length > 0 && (
                <View style={styles.dropdown}>
                  {filteredCustomers.map((c) => (
                    <TouchableOpacity key={c.id} style={styles.dropdownItem} onPress={() => selectCustomer(c)}>
                      <Text style={styles.dropdownItemName}>{c.name}</Text>
                      <Text style={styles.dropdownItemSub}>
                        {c.phone ? c.phone : ""}{c.email ? " \u2022 " + c.email : ""}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {showCustomerDropdown && form.partner_name.trim().length > 0 && filteredCustomers.length === 0 && (
                <View style={styles.dropdown}>
                  <Text style={styles.dropdownEmpty}>No customers found</Text>
                </View>
              )}
            </View>

            <View style={styles.row2Col}>
              <View style={styles.colHalf}>
                <TextInput
                  label="Phone"
                  placeholder="Phone number"
                  value={form.partner_phone}
                  onChangeText={(t) => handleChange("partner_phone", t)}
                  keyboardType="phone-pad"
                  editable={isEditable && !form.partner_id}
                  column
                />
              </View>
              <View style={styles.colHalf}>
                <TextInput
                  label="Email"
                  placeholder="Email address"
                  value={form.partner_email}
                  onChangeText={(t) => handleChange("partner_email", t)}
                  keyboardType="email-address"
                  editable={isEditable && !form.partner_id}
                  column
                />
              </View>
            </View>

            {form.customer_id ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Customer ID</Text>
                <Text style={styles.infoValue}>{form.customer_id}</Text>
              </View>
            ) : null}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Responsible</Text>
              <Text style={styles.infoValue}>{form.responsible}</Text>
            </View>
          </View>

          {/* ========= RENTAL PERIOD SECTION ========= */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionCardTitle}>RENTAL PERIOD</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Order Date</Text>
              <Text style={styles.infoValue}>{form.date_order}</Text>
            </View>

            <View style={styles.fieldGroup}>
              <TextInput
                label="Duration (Days)"
                value={form.rental_duration}
                onChangeText={(t) => handleChange("rental_duration", t)}
                keyboardType="numeric"
                editable={isEditable}
                column
              />
            </View>

            <View style={styles.row2Col}>
              <View style={styles.colHalf}>
                <TextInput
                  label="Planned Check-Out"
                  placeholder="YYYY-MM-DD"
                  value={form.date_planned_checkout}
                  onChangeText={(t) => handleChange("date_planned_checkout", t)}
                  editable={isEditable}
                  column
                />
              </View>
              <View style={styles.colHalf}>
                <TextInput
                  label="Planned Check-In"
                  placeholder="YYYY-MM-DD"
                  value={form.date_planned_checkin}
                  onChangeText={(t) => handleChange("date_planned_checkin", t)}
                  editable={isEditable}
                  column
                />
              </View>
            </View>
          </View>

          {/* ========= CHECK-OUT / CHECK-IN SECTION ========= */}
          {(state === "checked_out" || state === "checked_in" || state === "done" || state === "invoiced") && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionCardTitle}>CHECK-OUT / CHECK-IN</Text>
              <View style={styles.row2Col}>
                <View style={styles.colHalf}>
                  <Text style={styles.infoLabel}>Actual Check-Out</Text>
                  <Text style={[styles.infoValue, { marginTop: 2 }]}>{form.date_checkout || "-"}</Text>
                </View>
                <View style={styles.colHalf}>
                  <Text style={styles.infoLabel}>Actual Check-In</Text>
                  <Text style={[styles.infoValue, { marginTop: 2 }]}>{form.date_checkin || "-"}</Text>
                </View>
              </View>
              <View style={[styles.infoRow, { marginTop: 8 }]}>
                <Text style={styles.infoLabel}>Duration</Text>
                <Text style={styles.infoValue}>{form.actual_duration || form.rental_duration + " Day"}</Text>
              </View>
            </View>
          )}

          {/* ========= FINANCIALS SECTION ========= */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionCardTitle}>FINANCIALS</Text>

            <View style={styles.fieldGroup}>
              <TextInput
                label="Deposit Collected"
                placeholder="0.00"
                value={form.deposit_amount}
                onChangeText={(t) => handleChange("deposit_amount", t)}
                keyboardType="decimal-pad"
                editable={isEditable}
                column
              />
            </View>

            {!isEditable && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Deposit</Text>
                <Text style={styles.infoValue}>${form.deposit_amount || "0.00"}</Text>
              </View>
            )}

            {form.deposit_returned && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Deposit Status</Text>
                <Text style={[styles.infoValue, { color: "#4CAF50", fontWeight: "700" }]}>Returned</Text>
              </View>
            )}
          </View>

          {/* ========= TABS ========= */}
          <View style={styles.tabRow}>
            {getTabs().map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ----- TAB: RENTAL LINES ----- */}
          {activeTab === "lines" && (
            <View style={styles.tabContent}>
              {lines.map((line, idx) => (
                <View key={line.id} style={styles.lineCard}>
                  {/* Line header */}
                  <View style={styles.lineCardHeader}>
                    <Text style={styles.lineCardNum}>Line {idx + 1}</Text>
                    {state === "draft" && (
                      <TouchableOpacity onPress={() => removeLine(idx)}>
                        <Text style={styles.removeLineBtnText}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Tool selection - full width */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.inputLabel}>Tool</Text>
                    {isEditable ? (
                      <>
                        {line.tool_id && activeToolLineIdx !== idx ? (
                          <View style={styles.selectedToolRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.selectedToolName}>{line.tool_name}</Text>
                              <Text style={styles.selectedToolSub}>S/N: {line.serial_number || "-"}</Text>
                            </View>
                            {state === "draft" && (
                              <TouchableOpacity
                                onPress={() => {
                                  updateLine(idx, "tool_name", "");
                                  updateLine(idx, "tool_id", null);
                                  updateLine(idx, "serial_number", "");
                                  updateLine(idx, "unit_price", "");
                                  setActiveToolLineIdx(idx);
                                }}
                                style={styles.clearBtnSmall}
                              >
                                <Text style={styles.clearBtnText}>X</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        ) : (
                          <>
                            <TextInput
                              placeholder="Search tool..."
                              value={line.tool_name}
                              onChangeText={(t) => {
                                updateLine(idx, "tool_name", t);
                                setActiveToolLineIdx(idx);
                              }}
                              onFocus={() => setActiveToolLineIdx(idx)}
                              column
                            />
                            {activeToolLineIdx === idx && getFilteredTools(line.tool_name).length > 0 && (
                              <View style={styles.toolDropdown}>
                                {getFilteredTools(line.tool_name).map((t) => (
                                  <TouchableOpacity key={t.id} style={styles.dropdownItem} onPress={() => selectTool(idx, t)}>
                                    <Text style={styles.dropdownItemName}>{t.name}</Text>
                                    <Text style={styles.dropdownItemSub}>S/N: {t.serial_number || "-"} {"\u2022"} ${t.rental_price_per_day}/day</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            )}
                            {activeToolLineIdx === idx && line.tool_name.trim().length > 0 && getFilteredTools(line.tool_name).length === 0 && (
                              <View style={styles.toolDropdown}>
                                <Text style={styles.dropdownEmpty}>No tools found</Text>
                              </View>
                            )}
                          </>
                        )}
                        {!line.tool_id && (
                          <TextInput placeholder="Serial #" value={line.serial_number} onChangeText={(t) => updateLine(idx, "serial_number", t)} column />
                        )}
                      </>
                    ) : (
                      <View>
                        <Text style={styles.lineInfoText}>{line.tool_name}</Text>
                        <Text style={styles.lineInfoSub}>S/N: {line.serial_number || "-"}</Text>
                      </View>
                    )}
                  </View>

                  {/* Price / Duration / Total - 3 columns */}
                  <View style={styles.lineMetricsRow}>
                    <View style={styles.lineMetric}>
                      <Text style={styles.lineMetricLabel}>Price/Day</Text>
                      {isEditable ? (
                        <TextInput placeholder="0.00" value={line.unit_price} onChangeText={(t) => updateLine(idx, "unit_price", t)} keyboardType="decimal-pad" column />
                      ) : (
                        <Text style={styles.lineMetricValue}>${line.unit_price || "0.00"}</Text>
                      )}
                    </View>
                    <View style={styles.lineMetric}>
                      <Text style={styles.lineMetricLabel}>Duration</Text>
                      {isEditable ? (
                        <TextInput value={line.planned_duration} onChangeText={(t) => updateLine(idx, "planned_duration", t)} keyboardType="numeric" column />
                      ) : (
                        <Text style={styles.lineMetricValue}>{line.planned_duration}</Text>
                      )}
                    </View>
                    <View style={[styles.lineMetric, { alignItems: "flex-end" }]}>
                      <Text style={styles.lineMetricLabel}>Total</Text>
                      <Text style={styles.lineTotalText}>${calcLineTotal(line).toFixed(2)}</Text>
                    </View>
                  </View>

                  {/* Conditions */}
                  {state !== "draft" && (line.checkout_condition || line.checkin_condition) && (
                    <View style={styles.conditionDisplayRow}>
                      {line.checkout_condition ? <Text style={styles.conditionDisplayText}>Out: {line.checkout_condition}</Text> : null}
                      {line.checkin_condition ? <Text style={styles.conditionDisplayText}>In: {line.checkin_condition}</Text> : null}
                    </View>
                  )}
                </View>
              ))}

              {isEditable && (
                <TouchableOpacity onPress={addLine} style={styles.addLineBtn}>
                  <Text style={styles.addLineBtnText}>+ Add a line</Text>
                </TouchableOpacity>
              )}

              {errors.lines && <Text style={styles.errorText}>{errors.lines}</Text>}

              {lines.length > 0 && (
                <View style={styles.lineTotals}>
                  <View style={styles.lineTotalRow}>
                    <Text style={styles.lineTotalLabel}>Subtotal</Text>
                    <Text style={styles.lineTotalValue}>${calcSubtotal().toFixed(2)}</Text>
                  </View>
                  {calcLateFees() > 0 && (
                    <View style={styles.lineTotalRow}>
                      <Text style={styles.lineTotalLabel}>Late Fees</Text>
                      <Text style={styles.lineTotalValue}>${calcLateFees().toFixed(2)}</Text>
                    </View>
                  )}
                  {calcDamageCharges() > 0 && (
                    <View style={styles.lineTotalRow}>
                      <Text style={styles.lineTotalLabel}>Damage Charges</Text>
                      <Text style={styles.lineTotalValue}>${calcDamageCharges().toFixed(2)}</Text>
                    </View>
                  )}
                  {parseFloat(form.discount_amount) > 0 && (
                    <View style={styles.lineTotalRow}>
                      <Text style={styles.lineTotalLabel}>Discount</Text>
                      <Text style={styles.lineTotalValue}>-${parseFloat(form.discount_amount).toFixed(2)}</Text>
                    </View>
                  )}
                  <View style={[styles.lineTotalRow, styles.grandTotalRow]}>
                    <Text style={styles.grandTotalLabel}>TOTAL</Text>
                    <Text style={styles.grandTotalValue}>${calcTotal().toFixed(2)}</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ----- TAB: TIMESHEET / LOG ----- */}
          {activeTab === "timesheet" && (
            <View style={styles.tabContent}>
              {timesheet.length === 0 ? (
                <Text style={styles.emptyTabText}>No activity logged yet</Text>
              ) : (
                timesheet.map((t) => (
                  <View key={t.id} style={styles.tsRow}>
                    <View style={styles.tsLeft}>
                      <Text style={styles.tsUser}>{t.user}</Text>
                      <Text style={styles.tsTime}>{t.date} {t.time}</Text>
                    </View>
                    <Text style={styles.tsNote}>{t.notes}</Text>
                  </View>
                ))
              )}
            </View>
          )}

          {/* ----- TAB: CHECK-OUT DETAILS ----- */}
          {activeTab === "checkout_details" && (
            <View style={styles.tabContent}>
              <Text style={styles.detailLabel2}>ID Proof:</Text>
              <Text style={styles.detailValue2}>{checkoutIdProof ? "Captured" : "Not captured"}</Text>
              <Text style={styles.detailLabel2}>Customer Signature:</Text>
              <Text style={styles.detailValue2}>{checkoutSignature ? "Captured" : "Not captured"}</Text>
              {lines.map((line, idx) => (
                <View key={line.id} style={{ marginTop: 10 }}>
                  <Text style={styles.detailLabel2}>{line.tool_name || "Tool " + (idx + 1)} - Condition:</Text>
                  <Text style={styles.detailValue2}>{line.checkout_condition || "Not set"}</Text>
                  <Text style={styles.detailLabel2}>Tool Photo:</Text>
                  <Text style={styles.detailValue2}>{line.checkout_tool_image ? "Captured" : "Not captured"}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ----- TAB: NOTES & TERMS ----- */}
          {activeTab === "notes" && (
            <View style={styles.tabContent}>
              <TextInput label="Internal Notes" placeholder="Add notes..." value={form.notes} onChangeText={(t) => handleChange("notes", t)} multiline numberOfLines={3} column />
              <View style={{ height: 10 }} />
              <TextInput label="Terms & Conditions" placeholder="Add terms..." value={form.terms} onChangeText={(t) => handleChange("terms", t)} multiline numberOfLines={3} column />
            </View>
          )}

          {/* SAVE & CONFIRM BUTTONS for Draft */}
          {state === "draft" && (
            <View style={styles.bottomBtnRow}>
              <TouchableOpacity
                style={[styles.bottomBtn, { backgroundColor: COLORS.primaryThemeColor }]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.bottomBtnText}>{saving ? "Saving..." : "Save Draft"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bottomBtn, { backgroundColor: "#4CAF50" }]}
                onPress={actionConfirm}
                disabled={saving}
              >
                <Text style={styles.bottomBtnText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </RoundedContainer>

      {renderCheckoutModal()}
      {renderCheckinModal()}

      {/* CAMERA MODAL */}
      <CameraCapture
        visible={showCamera}
        onCapture={handleCameraCapture}
        onClose={() => { setShowCamera(false); setCameraCallback(null); }}
      />

      {/* SIGNATURE PAD MODAL */}
      <Modal visible={showSignaturePad} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.signPadModal}>
            <View style={styles.signPadHeader}>
              <Text style={styles.signPadTitle}>Draw Signature</Text>
              <TouchableOpacity onPress={() => { setShowSignaturePad(false); setActiveSignatureTarget(null); }}>
                <Text style={styles.modalClose}>X</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.signPadCanvas}>
              <SignaturePad
                ref={signatureRef}
                style={{ flex: 1 }}
                strokeColor="#000"
                strokeWidth={3}
              />
            </View>
            <View style={styles.signPadBtnRow}>
              <TouchableOpacity style={[styles.signPadBtn, { backgroundColor: "#9E9E9E" }]} onPress={handleSignatureClear}>
                <Text style={styles.signPadBtnText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.signPadBtn, { backgroundColor: "#4CAF50" }]}
                onPress={handleSignatureSave}
              >
                <Text style={styles.signPadBtnText}>Save Signature</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  scroll: { padding: 14, paddingBottom: 30 },

  // Action Buttons
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  actionBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  cancelActionBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: "#f5f5f5", borderWidth: 1, borderColor: "#ddd" },
  cancelActionBtnText: { color: "#333", fontSize: 13, fontWeight: "600" },

  // Breadcrumb - Step indicator
  breadcrumbRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 16, paddingHorizontal: 4 },
  breadcrumbItem: { flexDirection: "row", alignItems: "center" },
  breadcrumbDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#ddd" },
  breadcrumbDotActive: { backgroundColor: COLORS.primaryThemeColor, width: 12, height: 12, borderRadius: 6 },
  breadcrumbDotPast: { backgroundColor: "#4CAF50" },
  breadcrumbLabel: { fontSize: 9, color: "#aaa", marginLeft: 3, marginRight: 3, fontWeight: "500" },
  breadcrumbLabelActive: { color: COLORS.primaryThemeColor, fontWeight: "700", fontSize: 10 },
  breadcrumbLabelPast: { color: "#4CAF50", fontWeight: "600" },
  breadcrumbLine: { width: 16, height: 2, backgroundColor: "#ddd", marginHorizontal: 2 },
  breadcrumbLinePast: { backgroundColor: "#4CAF50" },

  // Section Cards
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  sectionCardTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primaryThemeColor,
    letterSpacing: 1,
    marginBottom: 12,
  },

  // Field Groups (vertical stacking)
  fieldGroup: { marginBottom: 8 },
  inputLabel: { fontSize: 12, fontWeight: "600", color: "#666", marginBottom: 4 },

  // 2-column layout
  row2Col: { flexDirection: "row", gap: 12, marginBottom: 8 },
  colHalf: { flex: 1 },

  // Info rows (read-only horizontal)
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  infoLabel: { fontSize: 13, color: "#888" },
  infoValue: { fontSize: 14, fontWeight: "500", color: COLORS.black },

  errorText: { color: COLORS.red, fontSize: 11, marginTop: 2 },

  // Period Chips
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  periodChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#f0f0f0", borderWidth: 1, borderColor: "#e0e0e0" },
  periodChipActive: { backgroundColor: COLORS.primaryThemeColor, borderColor: COLORS.primaryThemeColor },
  periodChipText: { fontSize: 13, color: "#666", fontWeight: "500" },
  periodChipTextActive: { color: "#fff", fontWeight: "600" },

  // Condition Chips
  condChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, borderWidth: 1, borderColor: "#ddd", backgroundColor: "#f9f9f9" },
  condChipActive: { backgroundColor: COLORS.primaryThemeColor, borderColor: COLORS.primaryThemeColor },
  condChipText: { fontSize: 11, color: "#666" },
  condChipTextActive: { color: "#fff", fontWeight: "600" },

  // Customer autocomplete
  selectedCustomerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0ebff",
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  selectedCustomerName: { fontSize: 14, fontWeight: "600", color: COLORS.black },
  selectedCustomerSub: { fontSize: 11, color: "#888", marginTop: 2 },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ddd",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  clearBtnSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#ddd",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 6,
  },
  clearBtnText: { fontSize: 11, fontWeight: "700", color: "#555" },

  // Dropdowns
  dropdown: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  toolDropdown: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 180,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  dropdownItemName: { fontSize: 14, fontWeight: "600", color: COLORS.black },
  dropdownItemSub: { fontSize: 11, color: "#888", marginTop: 2 },
  dropdownEmpty: { fontSize: 12, color: "#aaa", textAlign: "center", paddingVertical: 14 },

  // Tabs
  tabRow: { flexDirection: "row", marginTop: 4, marginBottom: 4, backgroundColor: COLORS.white, borderRadius: 10, padding: 4, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 },
  tabActive: { backgroundColor: COLORS.primaryThemeColor },
  tabText: { fontSize: 11, fontWeight: "600", color: "#888" },
  tabTextActive: { color: "#fff", fontWeight: "700" },
  tabContent: { paddingTop: 12, minHeight: 100 },

  // Rental Line Cards
  lineCard: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primaryThemeColor,
  },
  lineCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  lineCardNum: { fontSize: 13, fontWeight: "700", color: COLORS.primaryThemeColor },
  removeLineBtnText: { fontSize: 12, color: COLORS.red, fontWeight: "600" },
  lineInfoText: { fontSize: 14, fontWeight: "500", color: COLORS.black },
  lineInfoSub: { fontSize: 11, color: "#888", marginTop: 2 },

  // Tool autocomplete in lines
  selectedToolRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0ebff",
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  selectedToolName: { fontSize: 13, fontWeight: "600", color: COLORS.black },
  selectedToolSub: { fontSize: 11, color: "#888" },

  // Line metrics (Price / Duration / Total)
  lineMetricsRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  lineMetric: { flex: 1 },
  lineMetricLabel: { fontSize: 11, fontWeight: "600", color: "#888", marginBottom: 4 },
  lineMetricValue: { fontSize: 14, fontWeight: "500", color: COLORS.black },
  lineTotalText: { fontSize: 16, fontWeight: "700", color: COLORS.primaryThemeColor, marginTop: 4 },

  conditionDisplayRow: { flexDirection: "row", gap: 12, paddingVertical: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#f0f0f0", marginTop: 8 },
  conditionDisplayText: { fontSize: 11, color: "#888", textTransform: "capitalize" },

  addLineBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.primaryThemeColor,
    borderStyle: "dashed",
    alignItems: "center",
    marginBottom: 10,
  },
  addLineBtnText: { fontSize: 14, color: COLORS.primaryThemeColor, fontWeight: "600" },
  emptyTabText: { fontSize: 13, color: "#aaa", textAlign: "center", paddingTop: 30 },

  // Line Totals
  lineTotals: { marginTop: 12, paddingTop: 12, borderTopWidth: 2, borderTopColor: "#e0e0e0", backgroundColor: COLORS.white, borderRadius: 10, padding: 14 },
  lineTotalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  lineTotalLabel: { fontSize: 13, color: "#888" },
  lineTotalValue: { fontSize: 13, fontWeight: "600", color: COLORS.black },
  grandTotalRow: { borderTopWidth: 1, borderTopColor: "#e0e0e0", marginTop: 6, paddingTop: 10 },
  grandTotalLabel: { fontSize: 16, fontWeight: "700", color: COLORS.primaryThemeColor },
  grandTotalValue: { fontSize: 16, fontWeight: "700", color: COLORS.primaryThemeColor },

  // Timesheet
  tsRow: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f0f0f0", gap: 10 },
  tsLeft: { width: 100 },
  tsUser: { fontSize: 12, fontWeight: "600", color: COLORS.primaryThemeColor },
  tsTime: { fontSize: 10, color: "#888" },
  tsNote: { fontSize: 12, color: COLORS.black, flex: 1 },

  // Checkout detail tab
  detailLabel2: { fontSize: 13, fontWeight: "600", color: "#888", marginTop: 6 },
  detailValue2: { fontSize: 13, color: COLORS.black, marginBottom: 4 },

  // ======= MODAL =======
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center" },
  modalContent: { backgroundColor: "#fff", marginHorizontal: 12, marginVertical: 40, borderRadius: 12, padding: 16, maxHeight: "85%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: COLORS.black },
  modalClose: { fontSize: 18, fontWeight: "700", color: "#888", padding: 4 },

  modalInfoRow: { flexDirection: "row", marginBottom: 8 },
  modalLabel: { fontSize: 11, color: "#888" },
  modalValue: { fontSize: 13, color: COLORS.black, fontWeight: "500" },

  modalSection: { fontSize: 13, fontWeight: "700", color: "#333", marginTop: 16, marginBottom: 8, letterSpacing: 0.5 },
  modalFieldLabel: { fontSize: 11, fontWeight: "600", color: "#888", marginBottom: 4 },

  modalToolCard: { backgroundColor: "#f8f8f8", borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: "#eee" },
  modalToolRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  modalToolRow2: { flexDirection: "row", marginTop: 6 },
  modalToolName: { fontSize: 13, fontWeight: "600", color: COLORS.black },
  modalToolSerial: { fontSize: 11, color: "#888" },
  modalToolDetail: { fontSize: 12, color: "#888" },
  modalToolTotal: { fontSize: 13, fontWeight: "700", color: COLORS.primaryThemeColor },

  // Photo button
  photoBtn: { marginTop: 8, backgroundColor: "#f0f0f0", borderRadius: 6, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "#ddd", borderStyle: "dashed" },
  photoBtnDone: { backgroundColor: "#E8F5E9", borderColor: "#4CAF50", borderStyle: "solid" },
  photoBtnText: { fontSize: 12, color: "#888" },
  photoBtnTextDone: { color: "#2E7D32", fontWeight: "600" },

  // ID Proof
  idProofRow: { flexDirection: "row", gap: 10 },
  idProofBtn: { flex: 1, backgroundColor: "#f5f5f5", borderRadius: 6, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#ddd" },
  idProofBtnDone: { backgroundColor: "#E8F5E9", borderColor: "#4CAF50" },
  idProofBtnText: { fontSize: 12, color: "#888", fontWeight: "500" },
  idProofBtnTextDone: { color: "#2E7D32", fontWeight: "600" },

  // Signature
  signBox: { backgroundColor: "#f0f0f0", borderRadius: 8, padding: 20, alignItems: "center", borderWidth: 1, borderColor: "#ddd", borderStyle: "dashed", marginBottom: 10 },
  signBoxDone: { backgroundColor: "#E8F5E9", borderColor: "#4CAF50", borderStyle: "solid" },
  signBoxText: { fontSize: 13, color: "#888" },
  signBoxTextDone: { color: "#2E7D32", fontWeight: "700" },

  // Checkbox
  checkboxRow: { flexDirection: "row", alignItems: "center", paddingTop: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 3, borderWidth: 2, borderColor: "#999", justifyContent: "center", alignItems: "center", marginRight: 8 },
  checkboxChecked: { backgroundColor: COLORS.primaryThemeColor, borderColor: COLORS.primaryThemeColor },
  checkMark: { color: "#fff", fontSize: 13, fontWeight: "700" },
  checkboxLabel: { fontSize: 13, color: COLORS.black, fontWeight: "500" },

  // Total Damage
  totalDamageRow: { flexDirection: "row", justifyContent: "flex-end", paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#ddd", marginTop: 8, gap: 12 },
  totalDamageLabel: { fontSize: 13, fontWeight: "600", color: "#888" },
  totalDamageValue: { fontSize: 14, fontWeight: "700", color: COLORS.black },

  // Modal buttons
  modalBtnRow: { flexDirection: "row", gap: 10, marginTop: 16, marginBottom: 10 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 6, alignItems: "center" },
  modalBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // Captured image previews
  capturedImageWrap: { position: "relative", marginTop: 8, marginBottom: 8, backgroundColor: "#f9f9f9", borderRadius: 8, borderWidth: 1, borderColor: "#eee" },
  capturedImage: { width: "100%", height: 220, borderRadius: 8, resizeMode: "contain" },
  capturedIdProof: { width: "100%", height: 250, borderRadius: 8, resizeMode: "contain" },
  capturedSignature: { width: "100%", height: 160, borderRadius: 8, resizeMode: "contain", backgroundColor: "#fff" },
  photoRemoveBtn: { position: "absolute", top: 6, right: 6, backgroundColor: "rgba(0,0,0,0.6)", width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  photoRemoveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // Bottom action buttons
  bottomBtnRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  bottomBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: "center" },
  bottomBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Signature Pad Modal
  signPadModal: { backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, height: "60%", marginTop: "auto" },
  signPadHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  signPadTitle: { fontSize: 18, fontWeight: "700", color: COLORS.black },
  signPadCanvas: { flex: 1, borderRadius: 8, borderWidth: 1, borderColor: "#ddd", overflow: "hidden" },
  signPadBtnRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  signPadBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: "center" },
  signPadBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});

export default RentalOrderFormScreen;
