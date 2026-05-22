import dayjs from "dayjs";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { EmployeeDetailsResponse } from "../types";
import { useBreakpoint } from "../hooks/useBreakpoint";

interface EmployeeDetailModalProps {
  visible: boolean;
  employeeId: string | null;
  monthKey: string;
  onClose: () => void;
  onDataChange: () => void;
}

const fmt = (n: number) => `₹${n.toFixed(0)}`;

export const EmployeeDetailModal: React.FC<EmployeeDetailModalProps> = ({
  visible,
  employeeId,
  monthKey,
  onClose,
  onDataChange
}) => {
  const { isDesktop, width } = useBreakpoint();
  const isMobileSheet = !isDesktop;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EmployeeDetailsResponse | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceNotes, setAdvanceNotes] = useState("");
  const [savingAdvance, setSavingAdvance] = useState(false);

  const loadDetails = useCallback(async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<EmployeeDetailsResponse>(`/employees/${employeeId}`, {
        params: { monthKey }
      });
      setData(response.data);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [employeeId, monthKey]);

  useEffect(() => {
    if (visible && employeeId) void loadDetails();
  }, [visible, employeeId, loadDetails]);

  const handleAddAdvance = async () => {
    if (!employeeId) return;
    const amount = Number(advanceAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Invalid amount");
      return;
    }
    try {
      setSavingAdvance(true);
      setError(null);
      await api.post(`/employees/${employeeId}/advances`, {
        amount,
        notes: advanceNotes.trim(),
        monthKey,
        advanceDate: new Date().toISOString()
      });
      setAdvanceAmount("");
      setAdvanceNotes("");
      await loadDetails();
      onDataChange();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSavingAdvance(false);
    }
  };

  const handleDeleteAdvance = (advanceId: string) => {
    if (!employeeId) return;
    const run = async () => {
      await api.delete(`/employees/${employeeId}/advances/${advanceId}`);
      await loadDetails();
      onDataChange();
    };
    if (Platform.OS === "web") {
      if (window.confirm("Remove?")) void run().catch((e) => setError(getApiError(e)));
      return;
    }
    Alert.alert("Remove?", "", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => void run().catch((e) => setError(getApiError(e))) }
    ]);
  };

  if (!visible) return null;

  const net = data?.settlement.netPayable ?? 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, isMobileSheet ? styles.overlaySheet : null]}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            isMobileSheet ? styles.sheetMobile : null,
            isDesktop ? { maxWidth: Math.min(480, width - 48) } : null
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.head}>
            <View style={styles.headText}>
              <Text style={styles.title}>{data?.employee.name || "—"}</Text>
              <Text style={styles.month}>{dayjs(`${monthKey}-01`).format("MMM YYYY")}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          {loading ? <ActivityIndicator color={colors.accentStrong} style={{ marginVertical: spacing.md }} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {data ? (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              <View style={styles.statGrid}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Salary</Text>
                  <Text style={styles.statVal}>{fmt(data.employee.monthlySalary)}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Earned</Text>
                  <Text style={styles.statVal}>{fmt(data.settlement.earnedPay)}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Advance</Text>
                  <Text style={[styles.statVal, { color: colors.warning }]}>{fmt(data.settlement.totalAdvances)}</Text>
                </View>
                <View style={[styles.stat, styles.statNet]}>
                  <Text style={styles.statLabel}>Pay</Text>
                  <Text style={[styles.statValBig, { color: net >= 0 ? colors.success : colors.danger }]}>
                    {fmt(net)}
                  </Text>
                </View>
              </View>

              <Text style={styles.section}>New advance</Text>
              <View style={styles.rowInputs}>
                <TextInput
                  value={advanceAmount}
                  onChangeText={setAdvanceAmount}
                  placeholder="₹ Amount"
                  keyboardType="decimal-pad"
                  placeholderTextColor="#8CA0B8"
                  style={[styles.input, styles.inputAmt]}
                />
                <TextInput
                  value={advanceNotes}
                  onChangeText={setAdvanceNotes}
                  placeholder="Note"
                  placeholderTextColor="#8CA0B8"
                  style={[styles.input, styles.inputNote]}
                />
              </View>
              <Pressable
                style={[styles.addBtn, savingAdvance ? styles.disabled : null]}
                onPress={() => void handleAddAdvance()}
                disabled={savingAdvance}
              >
                <Text style={styles.addBtnText}>{savingAdvance ? "..." : "+ Add"}</Text>
              </Pressable>

              <Text style={styles.section}>Advances ({data.advances.length})</Text>
              {!data.advances.length ? (
                <Text style={styles.none}>None this month</Text>
              ) : (
                data.advances.map((a) => (
                  <View key={a.id} style={styles.advanceRow}>
                    <View style={styles.advanceLeft}>
                      <Text style={styles.advanceAmt}>{fmt(a.amount)}</Text>
                      <Text style={styles.advanceMeta}>
                        {a.advanceDate ? dayjs(a.advanceDate).format("DD MMM") : "—"}
                        {a.notes ? ` · ${a.notes}` : ""}
                      </Text>
                    </View>
                    <Pressable onPress={() => handleDeleteAdvance(a.id)} hitSlop={8}>
                      <Text style={styles.del}>✕</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg
  },
  overlaySheet: {
    justifyContent: "flex-end",
    padding: 0
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(24,50,74,0.4)"
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: "88%",
    width: "100%",
    alignSelf: "center",
    overflow: "hidden"
  },
  sheetMobile: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    maxHeight: "92%"
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginTop: spacing.sm
  },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm
  },
  headText: { flex: 1 },
  title: { fontFamily: fontFamily.bold, fontSize: 20, color: colors.textPrimary },
  month: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  close: { fontSize: 22, color: colors.textMuted, padding: spacing.xs },
  scroll: { flexGrow: 0 },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  stat: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md
  },
  statNet: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  statLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: "uppercase"
  },
  statVal: {
    fontFamily: fontFamily.bold,
    fontSize: 17,
    color: colors.textPrimary,
    marginTop: 4
  },
  statValBig: {
    fontFamily: fontFamily.bold,
    fontSize: 22
  },
  section: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: spacing.xs
  },
  rowInputs: { flexDirection: "row", gap: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontFamily: fontFamily.medium,
    color: colors.textPrimary,
    backgroundColor: "#FFF"
  },
  inputAmt: { width: 110 },
  inputNote: { flex: 1 },
  addBtn: {
    backgroundColor: colors.accentStrong,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: "center"
  },
  addBtnText: { color: colors.textOnDark, fontFamily: fontFamily.bold, fontSize: 14 },
  disabled: { opacity: 0.65 },
  none: { color: colors.textMuted, fontFamily: fontFamily.medium, fontSize: 13 },
  advanceRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: "#FFF"
  },
  advanceLeft: { flex: 1 },
  advanceAmt: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.textPrimary },
  advanceMeta: { fontFamily: fontFamily.medium, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  del: { fontSize: 18, color: colors.danger, fontFamily: fontFamily.bold, padding: spacing.xs },
  error: {
    marginHorizontal: spacing.lg,
    color: colors.danger,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    padding: spacing.sm,
    backgroundColor: "#FFF0EE",
    borderRadius: radius.sm
  }
});
