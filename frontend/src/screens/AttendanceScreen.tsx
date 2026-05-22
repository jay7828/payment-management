import dayjs from "dayjs";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { api, getApiError } from "../api/client";
import { colors, fontFamily, radius, spacing } from "../theme";
import { AttendanceStatus, EmployeeAttendanceRow } from "../types";
import { useBreakpoint } from "../hooks/useBreakpoint";

interface AttendanceScreenProps {
  refreshKey: number;
}

interface MonthAttendanceResponse {
  monthKey: string;
  employees: EmployeeAttendanceRow[];
}

const STATUS_KEYS: Array<{ key: AttendanceStatus; label: string; tone: "p" | "a" | "h" }> = [
  { key: "PRESENT", label: "P", tone: "p" },
  { key: "ABSENT", label: "A", tone: "a" },
  { key: "HALF_DAY", label: "½", tone: "h" }
];

export const AttendanceScreen: React.FC<AttendanceScreenProps> = ({ refreshKey }) => {
  const today = dayjs().format("YYYY-MM-DD");
  const [selectedDate, setSelectedDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<EmployeeAttendanceRow[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const { width } = useBreakpoint();
  const compact = width < 400;

  const monthKey = dayjs(selectedDate).format("YYYY-MM");

  const loadAttendance = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<MonthAttendanceResponse>("/attendance", { params: { monthKey } });
      setRows(response.data.employees || []);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance, refreshKey]);

  const statusFor = (row: EmployeeAttendanceRow) =>
    row.records.find((r) => r.dateKey === selectedDate)?.status ?? null;

  const markStatus = async (employeeId: string, status: AttendanceStatus) => {
    try {
      setSavingId(employeeId);
      setError(null);
      await api.post("/attendance", { employeeId, dateKey: selectedDate, status });
      await loadAttendance();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSavingId(null);
    }
  };

  const markAllPresent = async () => {
    if (!rows.length) return;
    try {
      setSavingId("bulk");
      await api.post("/attendance/bulk", {
        dateKey: selectedDate,
        status: "PRESENT",
        employeeIds: rows.map((r) => r.employee.id)
      });
      await loadAttendance();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSavingId(null);
    }
  };

  const isToday = selectedDate === today;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.dateRow}>
        <Pressable style={styles.arrow} onPress={() => setSelectedDate(dayjs(selectedDate).subtract(1, "day").format("YYYY-MM-DD"))}>
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>
        <View style={styles.dateMid}>
          <Text style={styles.dateText}>{dayjs(selectedDate).format("DD MMM YYYY")}</Text>
          {!isToday ? (
            <Pressable onPress={() => setSelectedDate(today)}>
              <Text style={styles.todayBtn}>Today</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable style={styles.arrow} onPress={() => setSelectedDate(dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD"))}>
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendItem}><Text style={styles.legendP}>P</Text> Present</Text>
        <Text style={styles.legendItem}><Text style={styles.legendA}>A</Text> Absent</Text>
        <Text style={styles.legendItem}><Text style={styles.legendH}>½</Text> Half</Text>
      </View>

      <Pressable
        style={[styles.allBtn, savingId === "bulk" ? styles.disabled : null]}
        onPress={() => void markAllPresent()}
        disabled={!rows.length}
      >
        <Text style={styles.allBtnText}>{savingId === "bulk" ? "..." : "All Present"}</Text>
      </Pressable>

      {loading ? <ActivityIndicator color={colors.accentStrong} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!rows.length && !loading ? (
        <Text style={styles.empty}>Add employees first (Employees menu).</Text>
      ) : null}

      {rows.map((row) => {
        const status = statusFor(row);
        const busy = savingId === row.employee.id;
        return (
          <View key={row.employee.id} style={[styles.card, compact ? styles.cardStack : null]}>
            <Text style={styles.name} numberOfLines={1}>
              {row.employee.name}
            </Text>
            <View style={styles.btns}>
              {STATUS_KEYS.map((btn) => {
                const on = status === btn.key;
                const activeStyle =
                  btn.tone === "p" ? styles.pActive : btn.tone === "a" ? styles.aActive : styles.hActive;
                return (
                  <Pressable
                    key={btn.key}
                    style={[styles.btn, on ? activeStyle : null]}
                    onPress={() => void markStatus(row.employee.id, btn.key)}
                    disabled={busy}
                  >
                    <Text style={[styles.btnText, on ? styles.btnTextOn : null]}>{busy ? "·" : btn.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl * 2 },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm
  },
  arrow: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.surface
  },
  arrowText: { fontSize: 24, fontFamily: fontFamily.bold, color: colors.textPrimary },
  dateMid: { flex: 1, alignItems: "center" },
  dateText: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.textPrimary },
  todayBtn: { fontFamily: fontFamily.medium, fontSize: 12, color: colors.accentStrong, marginTop: 2 },
  legend: { flexDirection: "row", justifyContent: "center", gap: spacing.lg },
  legendItem: { fontFamily: fontFamily.medium, fontSize: 12, color: colors.textMuted },
  legendP: { color: colors.success, fontFamily: fontFamily.bold },
  legendA: { color: colors.danger, fontFamily: fontFamily.bold },
  legendH: { color: colors.warning, fontFamily: fontFamily.bold },
  allBtn: {
    backgroundColor: colors.success,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: "center"
  },
  allBtnText: { color: colors.textOnDark, fontFamily: fontFamily.bold, fontSize: 14 },
  disabled: { opacity: 0.6 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md
  },
  cardStack: { flexDirection: "column", alignItems: "stretch" },
  name: { flex: 1, fontFamily: fontFamily.bold, fontSize: 16, color: colors.textPrimary },
  btns: { flexDirection: "row", gap: spacing.xs },
  btn: {
    width: 48,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  btnText: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.textPrimary },
  btnTextOn: { color: colors.textOnDark },
  pActive: { backgroundColor: colors.success, borderColor: colors.success },
  aActive: { backgroundColor: colors.danger, borderColor: colors.danger },
  hActive: { backgroundColor: colors.warning, borderColor: colors.warning },
  error: {
    color: colors.danger,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    padding: spacing.sm,
    backgroundColor: "#FFF0EE",
    borderRadius: radius.md
  },
  empty: { textAlign: "center", color: colors.textMuted, fontFamily: fontFamily.medium, fontSize: 13 }
});
