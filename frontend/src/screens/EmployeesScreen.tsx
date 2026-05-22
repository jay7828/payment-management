import dayjs from "dayjs";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { api, getApiError } from "../api/client";
import { EmployeeCard } from "../components/EmployeeCard";
import { colors, fontFamily, radius, spacing } from "../theme";
import { EmployeeCardData } from "../types";
import { EmployeeDetailModal } from "./EmployeeDetailModal";
import { useBreakpoint } from "../hooks/useBreakpoint";

interface EmployeesScreenProps {
  refreshKey: number;
  onDataChange: () => void;
}

interface EmployeesResponse {
  monthKey: string;
  employees: EmployeeCardData[];
}

export const EmployeesScreen: React.FC<EmployeesScreenProps> = ({ refreshKey, onDataChange }) => {
  const [monthKey, setMonthKey] = useState(dayjs().format("YYYY-MM"));
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeCardData[]>([]);
  const { isDesktop } = useBreakpoint();

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [salary, setSalary] = useState("");
  const [saving, setSaving] = useState(false);

  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<EmployeesResponse>("/employees", {
        params: {
          monthKey,
          ...(search.trim() ? { search: search.trim() } : {})
        }
      });
      setEmployees(response.data.employees || []);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [monthKey, search]);

  useEffect(() => {
    const timer = setTimeout(() => void loadEmployees(), 250);
    return () => clearTimeout(timer);
  }, [loadEmployees, refreshKey]);

  const monthOptions = Array.from({ length: 12 }, (_, i) => dayjs().subtract(i, "month").format("YYYY-MM"));

  const handleAddEmployee = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    const parsedSalary = Number(salary);
    if (!Number.isFinite(parsedSalary) || parsedSalary < 0) {
      setError("Enter a valid monthly salary");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await api.post("/employees", { name: name.trim(), monthlySalary: parsedSalary });
      setName("");
      setSalary("");
      setAddModalVisible(false);
      await loadEmployees();
      onDataChange();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.searchRow}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search employee"
            placeholderTextColor="#95A8BC"
            style={styles.searchInput}
          />
          <Pressable style={styles.addButton} onPress={() => setAddModalVisible(true)}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthRow}>
          {monthOptions.map((key) => {
            const active = key === monthKey;
            return (
              <Pressable
                key={key}
                style={[styles.monthChip, active ? styles.monthChipActive : null]}
                onPress={() => setMonthKey(key)}
              >
                <Text style={[styles.monthChipText, active ? styles.monthChipTextActive : null]}>
                  {dayjs(`${key}-01`).format("MMM YY")}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? <ActivityIndicator color={colors.accentStrong} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!employees.length && !loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No employees yet. Add one to track pay and advances.</Text>
          </View>
        ) : null}

        <View style={[styles.list, isDesktop ? styles.listDesktop : styles.listMobile]}>
          {employees.map((employee) => (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              fullWidth={!isDesktop}
              onPress={() => setSelectedEmployeeId(employee.id)}
            />
          ))}
        </View>
      </ScrollView>

      <Modal visible={addModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDesktop ? styles.modalCardDesktop : null]}>
            <Text style={styles.modalTitle}>Add Employee</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Employee name"
              placeholderTextColor="#8CA0B8"
              style={styles.input}
            />
            <TextInput
              value={salary}
              onChangeText={setSalary}
              placeholder="Monthly salary"
              placeholderTextColor="#8CA0B8"
              keyboardType="decimal-pad"
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setAddModalVisible(false)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, saving ? styles.primaryButtonDisabled : null]}
                onPress={() => void handleAddEmployee()}
                disabled={saving}
              >
                <Text style={styles.primaryButtonText}>{saving ? "Saving..." : "Save"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <EmployeeDetailModal
        visible={Boolean(selectedEmployeeId)}
        employeeId={selectedEmployeeId}
        monthKey={monthKey}
        onClose={() => setSelectedEmployeeId(null)}
        onDataChange={() => {
          onDataChange();
          void loadEmployees();
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  searchRow: { flexDirection: "row", gap: spacing.sm },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontFamily: fontFamily.medium,
    backgroundColor: colors.card
  },
  addButton: {
    backgroundColor: colors.accentStrong,
    borderRadius: radius.md,
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  addButtonText: { color: colors.textOnDark, fontFamily: fontFamily.bold, fontSize: 14 },
  monthRow: { gap: spacing.sm },
  monthChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: 8
  },
  monthChipActive: { backgroundColor: colors.accentStrong, borderColor: colors.accentStrong },
  monthChipText: { color: colors.textPrimary, fontFamily: fontFamily.medium, fontSize: 12 },
  monthChipTextActive: { color: colors.textOnDark, fontFamily: fontFamily.bold },
  error: {
    color: colors.danger,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    backgroundColor: "#FFF0EE",
    borderWidth: 1,
    borderColor: "#F3C8C1",
    borderRadius: radius.md,
    padding: spacing.md
  },
  emptyState: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg
  },
  emptyStateText: { color: colors.textPrimary, fontFamily: fontFamily.medium, textAlign: "center" },
  list: { gap: spacing.sm },
  listMobile: { width: "100%" },
  listDesktop: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(24,50,74,0.35)",
    justifyContent: "center",
    padding: spacing.lg
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border
  },
  modalCardDesktop: { maxWidth: 480, width: "100%", alignSelf: "center" },
  modalTitle: { color: colors.textPrimary, fontFamily: fontFamily.bold, fontSize: 20, marginBottom: spacing.xs },
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
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.sm },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    backgroundColor: "#FFFFFF"
  },
  secondaryButtonText: { color: colors.textPrimary, fontFamily: fontFamily.medium },
  primaryButton: {
    backgroundColor: colors.accentStrong,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md
  },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryButtonText: { color: colors.textOnDark, fontFamily: fontFamily.bold }
});
