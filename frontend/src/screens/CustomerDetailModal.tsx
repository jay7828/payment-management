import dayjs from "dayjs";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { api, getApiError } from "../api/client";
import { colors, fontFamily, radius, spacing } from "../theme";
import { Bill, CustomerDetailsResponse, Payment } from "../types";
import {
  DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
  loadWhatsAppTemplate,
  resolveWhatsAppTemplate
} from "../utils/whatsappTemplate";
import { useBreakpoint } from "../hooks/useBreakpoint";

interface CustomerDetailModalProps {
  visible: boolean;
  customerId: string | null;
  onClose: () => void;
  onDataChange: () => void;
}

const PAYMENT_MODES: Array<"CASH" | "UPI" | "BANK" | "OTHER"> = ["CASH", "UPI", "BANK", "OTHER"];

const billLabel = (bill: Bill) => `${bill.monthKey} • Due ₹${bill.dueAmount.toFixed(2)}`;

type ConfirmDialog = {
  title: string;
  message: string;
  onConfirm: () => void;
};

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  visible,
  customerId,
  onClose,
  onDataChange
}) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareInfo, setShareInfo] = useState<string | null>(null);
  const [details, setDetails] = useState<CustomerDetailsResponse | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const { isDesktop } = useBreakpoint();

  const showConfirm = (dialog: ConfirmDialog) => {
    if (Platform.OS === "web") {
      setConfirmDialog(dialog);
    } else {
      Alert.alert(dialog.title, dialog.message, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: dialog.onConfirm }
      ]);
    }
  };

  const [billMonthKey, setBillMonthKey] = useState(dayjs().format("YYYY-MM"));
  const [billAmount, setBillAmount] = useState("");
  const [billNotes, setBillNotes] = useState("");

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "UPI" | "BANK" | "OTHER">("CASH");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [whatsAppTemplate, setWhatsAppTemplate] = useState(DEFAULT_WHATSAPP_MESSAGE_TEMPLATE);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [sharingToWhatsApp, setSharingToWhatsApp] = useState(false);

  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [editBillMonthKey, setEditBillMonthKey] = useState("");
  const [editBillAmount, setEditBillAmount] = useState("");
  const [editBillNotes, setEditBillNotes] = useState("");
  const [editBillBilledDate, setEditBillBilledDate] = useState("");

  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState("");
  const [editPaymentMode, setEditPaymentMode] = useState<"CASH" | "UPI" | "BANK" | "OTHER">("CASH");
  const [editPaymentNotes, setEditPaymentNotes] = useState("");
  const [editPaymentDate, setEditPaymentDate] = useState("");

  const loadDetails = async () => {
    if (!customerId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await api.get<CustomerDetailsResponse>(`/customers/${customerId}`);
      setDetails(response.data);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && customerId) {
      setShareInfo(null);
      void loadDetails();
    }
  }, [visible, customerId]);

  useEffect(() => {
    if (!visible) {
      setEditingBillId(null);
      setEditingPaymentId(null);
    }
  }, [visible]);

  useEffect(() => {
    if (!details) {
      return;
    }

    const openBill = details.bills.find((bill) => bill.dueAmount > 0);
    setSelectedBillId(openBill ? openBill.id : null);
  }, [details]);

  useEffect(() => {
    let mounted = true;

    const loadTemplate = async () => {
      if (!visible) {
        return;
      }

      try {
        setTemplateLoading(true);
        const storedTemplate = await loadWhatsAppTemplate();
        if (mounted) {
          setWhatsAppTemplate(storedTemplate);
        }
      } catch (templateError) {
        if (mounted) {
          setWhatsAppTemplate(DEFAULT_WHATSAPP_MESSAGE_TEMPLATE);
        }
      } finally {
        if (mounted) {
          setTemplateLoading(false);
        }
      }
    };

    void loadTemplate();

    return () => {
      mounted = false;
    };
  }, [visible]);

  const unpaidBills = useMemo(() => details?.bills.filter((bill) => bill.dueAmount > 0) || [], [details]);

  const handleCreateBill = async () => {
    if (!customerId) {
      return;
    }

    const amount = Number(billAmount);
    if (!billMonthKey.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Enter valid month (YYYY-MM) and bill amount");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await api.post(`/customers/${customerId}/bills`, {
        monthKey: billMonthKey.trim(),
        amount,
        notes: billNotes.trim()
      });

      setBillAmount("");
      setBillNotes("");
      await loadDetails();
      onDataChange();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCustomer = () => {
    if (!customerId || !details) {
      return;
    }

    showConfirm({
      title: "Delete customer?",
      message: `This permanently removes ${details.customer.name}, all of their bills, and all payment records. This cannot be undone.`,
      onConfirm: async () => {
        try {
          setSubmitting(true);
          setError(null);
          await api.delete(`/customers/${customerId}`);
          onDataChange();
          onClose();
        } catch (requestError) {
          setError(getApiError(requestError));
        } finally {
          setSubmitting(false);
        }
      }
    });
  };

  const beginEditBill = (bill: Bill) => {
    setEditingPaymentId(null);
    setEditingBillId(bill.id);
    setEditBillMonthKey(bill.monthKey);
    setEditBillAmount(String(bill.amount));
    setEditBillNotes(bill.notes || "");
    setEditBillBilledDate(bill.billedDate ? dayjs(bill.billedDate).format("YYYY-MM-DD") : "");
  };

  const cancelEditBill = () => {
    setEditingBillId(null);
  };

  const handleSaveBillEdit = async () => {
    if (!customerId || !editingBillId) {
      return;
    }

    const amount = Number(editBillAmount);
    if (!editBillMonthKey.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid month (YYYY-MM) and bill amount");
      return;
    }

    let billedDateIso: string | undefined;
    if (editBillBilledDate.trim()) {
      const parsed = dayjs(editBillBilledDate.trim());
      if (!parsed.isValid()) {
        setError("Bill date must be YYYY-MM-DD");
        return;
      }
      billedDateIso = parsed.startOf("day").toISOString();
    }

    try {
      setSubmitting(true);
      setError(null);

      const payload: {
        monthKey: string;
        amount: number;
        notes: string;
        billedDate?: string;
      } = {
        monthKey: editBillMonthKey.trim(),
        amount,
        notes: editBillNotes.trim()
      };

      if (billedDateIso) {
        payload.billedDate = billedDateIso;
      }

      await api.patch(`/customers/${customerId}/bills/${editingBillId}`, payload);
      setEditingBillId(null);
      await loadDetails();
      onDataChange();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDeleteBill = (bill: Bill) => {
    if (!customerId) {
      return;
    }

    showConfirm({
      title: "Remove bill?",
      message: `This deletes the ${bill.monthKey} bill and every payment line tied to it. Balances are updated automatically.`,
      onConfirm: async () => {
        try {
          setSubmitting(true);
          setError(null);
          await api.delete(`/customers/${customerId}/bills/${bill.id}`);
          if (editingBillId === bill.id) {
            setEditingBillId(null);
          }
          await loadDetails();
          onDataChange();
        } catch (requestError) {
          setError(getApiError(requestError));
        } finally {
          setSubmitting(false);
        }
      }
    });
  };

  const beginEditPayment = (payment: Payment) => {
    setEditingBillId(null);
    setEditingPaymentId(payment.id);
    setEditPaymentAmount(String(payment.amount));
    setEditPaymentMode(payment.mode);
    setEditPaymentNotes(payment.notes || "");
    setEditPaymentDate(payment.paymentDate ? dayjs(payment.paymentDate).format("YYYY-MM-DD") : "");
  };

  const cancelEditPayment = () => {
    setEditingPaymentId(null);
  };

  const handleSavePaymentEdit = async () => {
    if (!customerId || !editingPaymentId) {
      return;
    }

    const amount = Number(editPaymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid payment amount");
      return;
    }

    const dateTrim = editPaymentDate.trim();
    if (!dateTrim || !dayjs(dateTrim).isValid()) {
      setError("Enter payment date as YYYY-MM-DD");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await api.patch(`/customers/${customerId}/payments/${editingPaymentId}`, {
        amount,
        mode: editPaymentMode,
        notes: editPaymentNotes.trim(),
        paymentDate: dayjs(dateTrim).startOf("day").toISOString()
      });

      setEditingPaymentId(null);
      await loadDetails();
      onDataChange();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDeletePayment = (payment: Payment) => {
    if (!customerId) {
      return;
    }

    showConfirm({
      title: "Remove payment?",
      message: "This reverses how this payment was applied to the bill and any extra credit. Balances are updated automatically.",
      onConfirm: async () => {
        try {
          setSubmitting(true);
          setError(null);
          await api.delete(`/customers/${customerId}/payments/${payment.id}`);
          if (editingPaymentId === payment.id) {
            setEditingPaymentId(null);
          }
          await loadDetails();
          onDataChange();
        } catch (requestError) {
          setError(getApiError(requestError));
        } finally {
          setSubmitting(false);
        }
      }
    });
  };

  const handleRecordPayment = async () => {
    if (!customerId) {
      return;
    }

    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter valid payment amount");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const payload: {
        amount: number;
        mode: string;
        notes: string;
        billId?: string;
      } = {
        amount,
        mode: paymentMode,
        notes: paymentNotes.trim()
      };

      if (selectedBillId) {
        payload.billId = selectedBillId;
      }

      await api.post(`/customers/${customerId}/payments`, payload);

      setPaymentAmount("");
      setPaymentNotes("");
      await loadDetails();
      onDataChange();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const normalizeMobileForWhatsApp = (mobileNumber: string) => {
    const digitsOnly = mobileNumber.replace(/\D/g, "");
    return digitsOnly.length >= 10 ? digitsOnly : "";
  };

  const buildWhatsAppMessage = () => {
    if (!details) {
      return "";
    }

    return resolveWhatsAppTemplate(whatsAppTemplate, {
      name: details.customer.name,
      mobile: details.customer.mobile,
      totalDue: details.customer.totalDue.toFixed(2),
      unpaidBills: String(details.customer.unpaidBillsCount),
      creditBalance: details.customer.creditBalance.toFixed(2),
      date: dayjs().format("DD MMM YYYY")
    });
  };

  const handleShareToWhatsApp = async () => {
    if (!details) {
      return;
    }

    try {
      setSharingToWhatsApp(true);
      setError(null);
      setShareInfo(null);

      const message = buildWhatsAppMessage();
      const encodedMessage = encodeURIComponent(message);
      const mobileForWhatsApp = normalizeMobileForWhatsApp(details.customer.mobile);

      if (!mobileForWhatsApp) {
        setShareInfo("Customer mobile is missing. Select the recipient manually in WhatsApp.");
      }

      const appUrl = mobileForWhatsApp
        ? `whatsapp://send?phone=${mobileForWhatsApp}&text=${encodedMessage}`
        : `whatsapp://send?text=${encodedMessage}`;
      const webUrl = mobileForWhatsApp
        ? `https://wa.me/${mobileForWhatsApp}?text=${encodedMessage}`
        : `https://wa.me/?text=${encodedMessage}`;

      if (await Linking.canOpenURL(appUrl)) {
        await Linking.openURL(appUrl);
        return;
      }

      await Linking.openURL(webUrl);
    } catch (requestError) {
      setError("Unable to open WhatsApp. Please try again.");
    } finally {
      setSharingToWhatsApp(false);
    }
  };

  return (
    <Modal visible={visible} animationType={isDesktop ? "fade" : "slide"} transparent>
      <View style={[styles.overlay, isDesktop ? styles.overlayDesktop : null]}>
        <View style={[styles.panel, isDesktop ? styles.panelDesktop : null]}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>{details?.customer.name || "Customer"}</Text>
              <Text style={styles.subtitle}>{details?.customer.mobile || ""}</Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                style={[styles.shareButton, sharingToWhatsApp || templateLoading || !details ? styles.disabled : null]}
                onPress={handleShareToWhatsApp}
                disabled={sharingToWhatsApp || templateLoading || !details}
              >
                <Text style={styles.shareButtonText}>{sharingToWhatsApp ? "Sharing..." : "WhatsApp"}</Text>
              </Pressable>
              <Pressable style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>

          {loading ? <ActivityIndicator color={colors.accentStrong} style={{ marginTop: spacing.md }} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {shareInfo ? <Text style={styles.info}>{shareInfo}</Text> : null}

          <ScrollView contentContainerStyle={[styles.content, isDesktop ? styles.contentDesktop : null]}>
            {/* Summary card */}
            {details ? (
              <View style={styles.summaryCard}>
                <View>
                  <Text style={styles.summaryLabel}>Total Due</Text>
                  <Text style={styles.summaryDue}>₹{details.customer.totalDue.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRight}>
                  <Text style={styles.summarySmall}>Previous: ₹{details.customer.previousBalance.toFixed(2)}</Text>
                  <Text style={styles.summarySmall}>Credit: ₹{details.customer.creditBalance.toFixed(2)}</Text>
                  <Text style={[styles.summarySmall, details.customer.unpaidBillsCount > 3 ? styles.summaryAlert : null]}>
                    Unpaid Bills: {details.customer.unpaidBillsCount}
                  </Text>
                  <Text style={styles.summarySmall}>Bills Unpaid ₹{details.customer.totalUnpaidBillAmount.toFixed(2)}</Text>
                </View>
              </View>
            ) : null}

            {/* Desktop: two-column split; Mobile: stacked */}
            <View style={isDesktop ? styles.twoColDesktop : null}>
              {/* Left column: forms */}
              <View style={isDesktop ? styles.colLeft : null}>
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Create Monthly Bill</Text>
                  <TextInput
                    value={billMonthKey}
                    onChangeText={setBillMonthKey}
                    placeholder="YYYY-MM"
                    placeholderTextColor="#8094AF"
                    style={styles.input}
                  />
                  <TextInput
                    value={billAmount}
                    onChangeText={setBillAmount}
                    keyboardType="decimal-pad"
                    placeholder="Bill amount"
                    placeholderTextColor="#8094AF"
                    style={styles.input}
                  />
                  <TextInput
                    value={billNotes}
                    onChangeText={setBillNotes}
                    placeholder="Notes (optional)"
                    placeholderTextColor="#8094AF"
                    style={styles.input}
                  />
                  <Pressable style={[styles.actionButton, submitting ? styles.disabled : null]} onPress={handleCreateBill}>
                    <Text style={styles.actionButtonText}>Add Bill</Text>
                  </Pressable>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Record Payment</Text>
                  <TextInput
                    value={paymentAmount}
                    onChangeText={setPaymentAmount}
                    keyboardType="decimal-pad"
                    placeholder="Payment amount"
                    placeholderTextColor="#8094AF"
                    style={styles.input}
                  />

                  <Text style={styles.fieldLabel}>Payment Mode</Text>
                  <View style={styles.modeRow}>
                    {PAYMENT_MODES.map((mode) => (
                      <Pressable
                        key={mode}
                        style={[styles.modeChip, paymentMode === mode ? styles.modeChipActive : null]}
                        onPress={() => setPaymentMode(mode)}
                      >
                        <Text style={[styles.modeChipText, paymentMode === mode ? styles.modeChipTextActive : null]}>{mode}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>Apply To Bill</Text>
                  <View style={styles.billChipWrap}>
                    {unpaidBills.length ? (
                      unpaidBills.map((bill) => (
                        <Pressable
                          key={bill.id}
                          style={[styles.billChip, selectedBillId === bill.id ? styles.billChipActive : null]}
                          onPress={() => setSelectedBillId(bill.id)}
                        >
                          <Text style={[styles.billChipText, selectedBillId === bill.id ? styles.billChipTextActive : null]}>
                            {billLabel(bill)}
                          </Text>
                        </Pressable>
                      ))
                    ) : (
                      <Text style={styles.helpText}>No unpaid bill. Payment will be saved as advance credit.</Text>
                    )}
                  </View>

                  <TextInput
                    value={paymentNotes}
                    onChangeText={setPaymentNotes}
                    placeholder="Notes (optional)"
                    placeholderTextColor="#8094AF"
                    style={styles.input}
                  />

                  <Pressable style={[styles.actionButton, submitting ? styles.disabled : null]} onPress={handleRecordPayment}>
                    <Text style={styles.actionButtonText}>Add Payment</Text>
                  </Pressable>
                </View>

                {details ? (
                  <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Remove customer</Text>
                    <Text style={styles.helpText}>
                      Deletes this customer and every bill and payment linked to them. Use this when you no longer need the account.
                    </Text>
                    <Pressable
                      style={[styles.dangerButton, submitting ? styles.disabled : null]}
                      onPress={handleDeleteCustomer}
                      disabled={submitting}
                    >
                      <Text style={styles.dangerButtonText}>{submitting ? "Working…" : "Delete customer"}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>

              {/* Right column: bills & payments history */}
              <View style={isDesktop ? styles.colRight : null}>
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Bills</Text>
                  {details?.bills.map((bill) => (
                    <View style={styles.historyBlock} key={bill.id}>
                      <View style={styles.historyRow}>
                        <View style={styles.historyRowLeft}>
                          <Text style={styles.historyTitle}>{bill.monthKey}</Text>
                          <Text style={styles.historyMeta}>
                            Billed {bill.billedDate ? dayjs(bill.billedDate).format("DD MMM YYYY") : "-"}
                          </Text>
                        </View>
                        <View style={styles.historyRowRight}>
                          <Text style={styles.historyAmount}>₹{bill.amount.toFixed(2)}</Text>
                          <Text style={[styles.historyMeta, bill.dueAmount > 0 ? styles.dueText : styles.paidText]}>
                            {bill.status} • Due ₹{bill.dueAmount.toFixed(2)}
                          </Text>
                        </View>
                      </View>

                      {editingBillId === bill.id ? (
                        <View style={styles.editBlock}>
                          <TextInput
                            value={editBillMonthKey}
                            onChangeText={setEditBillMonthKey}
                            placeholder="YYYY-MM"
                            placeholderTextColor="#8094AF"
                            style={styles.input}
                          />
                          <TextInput
                            value={editBillAmount}
                            onChangeText={setEditBillAmount}
                            keyboardType="decimal-pad"
                            placeholder="Bill amount"
                            placeholderTextColor="#8094AF"
                            style={styles.input}
                          />
                          <TextInput
                            value={editBillNotes}
                            onChangeText={setEditBillNotes}
                            placeholder="Notes"
                            placeholderTextColor="#8094AF"
                            style={styles.input}
                          />
                          <TextInput
                            value={editBillBilledDate}
                            onChangeText={setEditBillBilledDate}
                            placeholder="Billed date YYYY-MM-DD (optional)"
                            placeholderTextColor="#8094AF"
                            style={styles.input}
                          />
                          <View style={styles.editActions}>
                            <Pressable
                              style={[styles.outlineButton, submitting ? styles.disabled : null]}
                              onPress={cancelEditBill}
                              disabled={submitting}
                            >
                              <Text style={styles.outlineButtonText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                              style={[styles.actionButton, styles.editSaveButton, submitting ? styles.disabled : null]}
                              onPress={handleSaveBillEdit}
                              disabled={submitting}
                            >
                              <Text style={styles.actionButtonText}>Save bill</Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.rowActions}>
                          <Pressable onPress={() => beginEditBill(bill)} hitSlop={8}>
                            <Text style={styles.rowActionText}>Edit</Text>
                          </Pressable>
                          <Pressable onPress={() => confirmDeleteBill(bill)} hitSlop={8}>
                            <Text style={[styles.rowActionText, styles.rowActionDanger]}>Remove</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  ))}
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Recent Payments</Text>
                  {details?.payments.map((payment) => (
                    <View style={styles.historyBlock} key={payment.id}>
                      <View style={styles.historyRow}>
                        <View style={styles.historyRowLeft}>
                          <Text style={styles.historyTitle}>₹{payment.amount.toFixed(2)}</Text>
                          <Text style={styles.historyMeta}>{payment.mode}</Text>
                        </View>
                        <View style={styles.historyRowRight}>
                          <Text style={styles.historyMeta}>
                            {payment.paymentDate ? dayjs(payment.paymentDate).format("DD MMM YYYY") : "-"}
                          </Text>
                          <Text style={styles.historyMeta}>Credit ₹{payment.extraCredit.toFixed(2)}</Text>
                        </View>
                      </View>

                      {editingPaymentId === payment.id ? (
                        <View style={styles.editBlock}>
                          <TextInput
                            value={editPaymentAmount}
                            onChangeText={setEditPaymentAmount}
                            keyboardType="decimal-pad"
                            placeholder="Amount"
                            placeholderTextColor="#8094AF"
                            style={styles.input}
                          />
                          <Text style={styles.fieldLabel}>Mode</Text>
                          <View style={styles.modeRow}>
                            {PAYMENT_MODES.map((mode) => (
                              <Pressable
                                key={mode}
                                style={[styles.modeChip, editPaymentMode === mode ? styles.modeChipActive : null]}
                                onPress={() => setEditPaymentMode(mode)}
                              >
                                <Text style={[styles.modeChipText, editPaymentMode === mode ? styles.modeChipTextActive : null]}>
                                  {mode}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                          <TextInput
                            value={editPaymentDate}
                            onChangeText={setEditPaymentDate}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor="#8094AF"
                            style={styles.input}
                          />
                          <TextInput
                            value={editPaymentNotes}
                            onChangeText={setEditPaymentNotes}
                            placeholder="Notes"
                            placeholderTextColor="#8094AF"
                            style={styles.input}
                          />
                          <View style={styles.editActions}>
                            <Pressable
                              style={[styles.outlineButton, submitting ? styles.disabled : null]}
                              onPress={cancelEditPayment}
                              disabled={submitting}
                            >
                              <Text style={styles.outlineButtonText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                              style={[styles.actionButton, styles.editSaveButton, submitting ? styles.disabled : null]}
                              onPress={handleSavePaymentEdit}
                              disabled={submitting}
                            >
                              <Text style={styles.actionButtonText}>Save payment</Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.rowActions}>
                          <Pressable onPress={() => beginEditPayment(payment)} hitSlop={8}>
                            <Text style={styles.rowActionText}>Edit</Text>
                          </Pressable>
                          <Pressable onPress={() => confirmDeletePayment(payment)} hitSlop={8}>
                            <Text style={[styles.rowActionText, styles.rowActionDanger]}>Remove</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* Web-safe confirm dialog */}
        {confirmDialog ? (
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>{confirmDialog.title}</Text>
              <Text style={styles.confirmMessage}>{confirmDialog.message}</Text>
              <View style={styles.confirmActions}>
                <Pressable style={styles.confirmCancel} onPress={() => setConfirmDialog(null)}>
                  <Text style={styles.confirmCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.confirmDelete}
                  onPress={() => {
                    setConfirmDialog(null);
                    confirmDialog.onConfirm();
                  }}
                >
                  <Text style={styles.confirmDeleteText}>Confirm</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(7,17,31,0.65)",
    justifyContent: "flex-end"
  },
  overlayDesktop: {
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl
  },
  panel: {
    height: "92%",
    backgroundColor: colors.cardSoft,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.lg
  },
  panelDesktop: {
    height: "auto",
    maxHeight: "90%",
    width: "100%",
    maxWidth: 960,
    borderRadius: radius.xl,
    paddingTop: spacing.lg,
    shadowColor: "#07111F",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 30,
    elevation: 10
  },
  header: {
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  headerLeft: {
    flex: 1,
    marginRight: spacing.md
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    flexShrink: 0
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 22
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    marginTop: 2
  },
  closeButton: {
    backgroundColor: colors.accentStrong,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14
  },
  shareButton: {
    backgroundColor: colors.success,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14
  },
  shareButtonText: {
    color: colors.textOnDark,
    fontFamily: fontFamily.bold,
    fontSize: 13
  },
  closeButtonText: {
    color: colors.textOnDark,
    fontFamily: fontFamily.bold,
    fontSize: 13
  },
  error: {
    color: colors.danger,
    fontFamily: fontFamily.medium,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm
  },
  info: {
    color: colors.warning,
    fontFamily: fontFamily.medium,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
    fontSize: 12
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl * 2
  },
  contentDesktop: {
    padding: spacing.xl,
    paddingBottom: spacing.xl
  },
  twoColDesktop: {
    flexDirection: "row",
    gap: spacing.lg,
    alignItems: "flex-start"
  },
  colLeft: {
    flex: 1,
    gap: spacing.md
  },
  colRight: {
    flex: 1,
    gap: spacing.md
  },
  summaryCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  summaryLabel: {
    color: "#4E6783",
    fontFamily: fontFamily.medium,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.7
  },
  summaryDue: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 30,
    marginTop: spacing.xs
  },
  summaryRight: {
    alignItems: "flex-end",
    gap: 5
  },
  summarySmall: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 12
  },
  summaryAlert: {
    color: colors.danger,
    fontFamily: fontFamily.bold
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 18
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontFamily: fontFamily.medium,
    color: colors.textPrimary,
    backgroundColor: "#FFFFFF"
  },
  fieldLabel: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    marginTop: 4,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  modeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF"
  },
  modeChipActive: {
    backgroundColor: "#D6F3EE",
    borderColor: "#9DDCCE"
  },
  modeChipText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.medium,
    fontSize: 12
  },
  modeChipTextActive: {
    color: colors.accentStrong,
    fontFamily: fontFamily.bold
  },
  billChipWrap: {
    gap: spacing.sm
  },
  billChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  billChipActive: {
    borderColor: "#9DDCCE",
    backgroundColor: "#D6F3EE"
  },
  billChipText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.medium,
    fontSize: 12
  },
  billChipTextActive: {
    color: colors.accentStrong,
    fontFamily: fontFamily.bold
  },
  helpText: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 12
  },
  actionButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.accentStrong,
    borderRadius: radius.md,
    alignItems: "center",
    paddingVertical: 12
  },
  disabled: {
    opacity: 0.7
  },
  actionButtonText: {
    color: colors.textOnDark,
    fontFamily: fontFamily.bold,
    fontSize: 14
  },
  historyRow: {
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  historyBlock: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md
  },
  historyRowLeft: {
    flex: 1,
    paddingRight: spacing.sm
  },
  historyRowRight: {
    alignItems: "flex-end"
  },
  editBlock: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: "#FAFCFF"
  },
  rowActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  rowActionText: {
    color: colors.accentStrong,
    fontFamily: fontFamily.bold,
    fontSize: 13
  },
  rowActionDanger: {
    color: colors.danger
  },
  editActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
    alignItems: "stretch"
  },
  outlineButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    backgroundColor: "#FFFFFF"
  },
  outlineButtonText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 14
  },
  editSaveButton: {
    flex: 1,
    marginTop: 0
  },
  historyTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 14
  },
  historyMeta: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    marginTop: 3
  },
  historyAmount: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 16
  },
  dueText: {
    color: colors.danger
  },
  paidText: {
    color: colors.success
  },
  dangerButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    alignItems: "center",
    paddingVertical: 12
  },
  dangerButtonText: {
    color: colors.textOnDark,
    fontFamily: fontFamily.bold,
    fontSize: 14
  },
  confirmOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(7,17,31,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl
  },
  confirmCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    maxWidth: 420,
    width: "100%",
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    shadowColor: "#07111F",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 8
  },
  confirmTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 18
  },
  confirmMessage: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20
  },
  confirmActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  confirmCancel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    backgroundColor: "#FFFFFF"
  },
  confirmCancelText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.medium,
    fontSize: 14
  },
  confirmDelete: {
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg
  },
  confirmDeleteText: {
    color: colors.textOnDark,
    fontFamily: fontFamily.bold,
    fontSize: 14
  }
});

