import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
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
import { CustomerCard } from "../components/CustomerCard";
import { colors, fontFamily, radius, spacing } from "../theme";
import { CustomerCardData } from "../types";
import { CustomerDetailModal } from "./CustomerDetailModal";

interface CustomersScreenProps {
  refreshKey: number;
  onDataChange: () => void;
  focusCustomerId: string | null;
  onFocusHandled: () => void;
}

interface CustomersResponse {
  customers: CustomerCardData[];
}

type CustomerFilter = "ALL" | "UNPAID_OVER_3" | "FULLY_PAID";

const FILTER_OPTIONS: Array<{ key: CustomerFilter; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "UNPAID_OVER_3", label: "Unpaid > 3" },
  { key: "FULLY_PAID", label: "Fully Paid" }
];

export const CustomersScreen: React.FC<CustomersScreenProps> = ({
  refreshKey,
  onDataChange,
  focusCustomerId,
  onFocusHandled
}) => {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<CustomerFilter>("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerCardData[]>([]);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [otherInfo, setOtherInfo] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get<CustomersResponse>("/customers", {
        params: search.trim() ? { search: search.trim() } : undefined
      });

      setCustomers(response.data.customers || []);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCustomers();
    }, 250);

    return () => clearTimeout(timer);
  }, [loadCustomers, refreshKey]);

  useEffect(() => {
    if (focusCustomerId) {
      setSelectedCustomerId(focusCustomerId);
      onFocusHandled();
    }
  }, [focusCustomerId, onFocusHandled]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (selectedCustomerId) {
        setSelectedCustomerId(null);
        return true;
      }

      if (addModalVisible) {
        setAddModalVisible(false);
        return true;
      }

      return false;
    });

    return () => {
      subscription.remove();
    };
  }, [selectedCustomerId, addModalVisible]);

  const resetAddForm = () => {
    setName("");
    setMobile("");
    setAddress("");
    setOtherInfo("");
    setOpeningBalance("");
  };

  const handleAddCustomer = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    const parsedOpeningBalance = Number(openingBalance);
    const previousBalance = Number.isFinite(parsedOpeningBalance) && parsedOpeningBalance > 0 ? parsedOpeningBalance : 0;

    try {
      setSavingCustomer(true);
      setError(null);

      await api.post("/customers", {
        name: name.trim(),
        mobile: mobile.trim(),
        address: address.trim(),
        otherInfo: otherInfo.trim(),
        previousBalance
      });

      resetAddForm();
      setAddModalVisible(false);
      await loadCustomers();
      onDataChange();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleDataUpdated = () => {
    onDataChange();
    void loadCustomers();
  };

  const filterCounts = useMemo(
    () => ({
      ALL: customers.length,
      UNPAID_OVER_3: customers.filter((customer) => customer.unpaidBillsCount > 3).length,
      FULLY_PAID: customers.filter((customer) => customer.totalDue <= 0 && customer.unpaidBillsCount === 0).length
    }),
    [customers]
  );

  const filteredCustomers = useMemo(() => {
    if (activeFilter === "UNPAID_OVER_3") {
      return customers.filter((customer) => customer.unpaidBillsCount > 3);
    }

    if (activeFilter === "FULLY_PAID") {
      return customers.filter((customer) => customer.totalDue <= 0 && customer.unpaidBillsCount === 0);
    }

    return customers;
  }, [customers, activeFilter]);

  const emptyStateMessage =
    activeFilter === "UNPAID_OVER_3"
      ? "No customers with more than 3 unpaid bills."
      : activeFilter === "FULLY_PAID"
        ? "No fully paid customers found."
        : "No customers found.";

  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.searchRow}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, mobile, address"
            placeholderTextColor="#95A8BC"
            style={styles.searchInput}
          />
          <Pressable style={styles.addButton} onPress={() => setAddModalVisible(true)}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map((option) => {
            const active = option.key === activeFilter;
            return (
              <Pressable
                key={option.key}
                style={[styles.filterChip, active ? styles.filterChipActive : null]}
                onPress={() => setActiveFilter(option.key)}
              >
                <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>
                  {option.label} ({filterCounts[option.key]})
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? <ActivityIndicator color={colors.accentStrong} style={{ marginTop: spacing.md }} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!filteredCustomers.length && !loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{emptyStateMessage}</Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {filteredCustomers.map((customer) => (
            <CustomerCard key={customer.id} customer={customer} onPress={() => setSelectedCustomerId(customer.id)} />
          ))}
        </View>
      </ScrollView>

      <Modal visible={addModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Customer</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Customer name"
              placeholderTextColor="#8CA0B8"
              style={styles.input}
            />
            <TextInput
              value={mobile}
              onChangeText={setMobile}
              placeholder="Mobile (optional)"
              placeholderTextColor="#8CA0B8"
              keyboardType="phone-pad"
              style={styles.input}
            />
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Address"
              placeholderTextColor="#8CA0B8"
              style={styles.input}
            />
            <TextInput
              value={otherInfo}
              onChangeText={setOtherInfo}
              placeholder="Other info"
              placeholderTextColor="#8CA0B8"
              style={styles.input}
            />
            <TextInput
              value={openingBalance}
              onChangeText={setOpeningBalance}
              placeholder="Previous balance"
              placeholderTextColor="#8CA0B8"
              keyboardType="decimal-pad"
              style={styles.input}
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setAddModalVisible(false)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, savingCustomer ? styles.primaryButtonDisabled : null]}
                onPress={handleAddCustomer}
                disabled={savingCustomer}
              >
                <Text style={styles.primaryButtonText}>{savingCustomer ? "Saving..." : "Save"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <CustomerDetailModal
        visible={Boolean(selectedCustomerId)}
        customerId={selectedCustomerId}
        onClose={() => setSelectedCustomerId(null)}
        onDataChange={handleDataUpdated}
      />
    </>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl * 2
  },
  searchRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: 8
  },
  filterChipActive: {
    backgroundColor: colors.accentStrong,
    borderColor: colors.accentStrong
  },
  filterChipText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.medium,
    fontSize: 12
  },
  filterChipTextActive: {
    color: colors.textOnDark,
    fontFamily: fontFamily.bold
  },
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
  addButtonText: {
    color: colors.textOnDark,
    fontFamily: fontFamily.bold,
    fontSize: 14
  },
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
  emptyStateText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.medium,
    textAlign: "center"
  },
  list: {
    gap: spacing.sm
  },
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
  modalTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 20,
    marginBottom: spacing.xs
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
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    backgroundColor: "#FFFFFF"
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.medium
  },
  primaryButton: {
    backgroundColor: colors.accentStrong,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md
  },
  primaryButtonDisabled: {
    opacity: 0.7
  },
  primaryButtonText: {
    color: colors.textOnDark,
    fontFamily: fontFamily.bold
  }
});
