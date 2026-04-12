import dayjs from "dayjs";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, getApiError } from "../api/client";
import { MetricCard } from "../components/MetricCard";
import { colors, fontFamily, radius, spacing } from "../theme";
import { HomeSummary } from "../types";

interface HomeScreenProps {
  refreshKey: number;
  onOpenCustomer: (customerId: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ refreshKey, onOpenCustomer }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<HomeSummary | null>(null);

  const loadSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<HomeSummary>("/reports/home-summary");
      setSummary(response.data);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary();
  }, [refreshKey]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Total Due Payment</Text>
        <Text style={styles.heroValue}>₹{(summary?.totalDue || 0).toFixed(2)}</Text>
        <Text style={styles.heroSubtext}>Live balance across all active customers</Text>
      </View>

      {loading ? <ActivityIndicator color={colors.accentStrong} style={{ marginTop: 30 }} /> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.metricGrid}>
        <MetricCard label="Active Customers" value={String(summary?.totalCustomers || 0)} />
        <MetricCard label="Customers With Due" value={String(summary?.customersWithDue || 0)} accentColor={colors.danger} />
        <MetricCard
          label="This Month Collection"
          value={`₹${(summary?.currentMonthCollection || 0).toFixed(2)}`}
          accentColor={colors.success}
        />
      </View>

      <Text style={styles.sectionTitle}>Due Customers</Text>

      {!summary?.dueCustomers.length && !loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No pending due amount. All customers are paid.</Text>
        </View>
      ) : null}

      {summary?.dueCustomers.map((customer) => {
        const statusDate = customer.statusDate ? dayjs(customer.statusDate).format("DD MMM YYYY") : "-";
        const dueAmountColor =
          customer.totalDue <= 0
            ? colors.success
            : customer.unpaidBillsCount > 1 && customer.unpaidBillsCount < 3
              ? colors.warning
              : colors.danger;

        return (
          <Pressable key={customer.id} style={styles.dueCard} onPress={() => onOpenCustomer(customer.id)}>
            <View>
              <Text style={styles.dueName}>{customer.name}</Text>
              <Text style={styles.dueMobile}>{customer.mobile}</Text>
            </View>
            <View style={styles.dueRight}>
              <Text style={[styles.dueAmount, { color: dueAmountColor }]}>₹{customer.totalDue.toFixed(2)}</Text>
              <Text style={styles.dueMeta}>
                {customer.currentMonthStatus} • {statusDate}
              </Text>
              <Text style={[styles.unpaidMeta, customer.unpaidBillsCount > 3 ? styles.unpaidMetaAlert : null]}>
                Unpaid Bills: {customer.unpaidBillsCount} • Bills ₹{customer.totalUnpaidBillAmount.toFixed(2)}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl * 2
  },
  heroCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border
  },
  heroLabel: {
    color: "#4E6783",
    fontFamily: fontFamily.medium,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1
  },
  heroValue: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 38,
    marginTop: spacing.sm
  },
  heroSubtext: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    marginTop: 4
  },
  error: {
    color: colors.danger,
    fontFamily: fontFamily.medium,
    backgroundColor: "#FFF0EE",
    borderWidth: 1,
    borderColor: "#F3C8C1",
    borderRadius: radius.md,
    padding: spacing.md
  },
  metricGrid: {
    gap: spacing.sm
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 20,
    marginTop: spacing.sm
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
    fontSize: 14,
    textAlign: "center"
  },
  dueCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  dueName: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 17
  },
  dueMobile: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    marginTop: 3
  },
  dueRight: {
    alignItems: "flex-end"
  },
  dueAmount: {
    fontFamily: fontFamily.bold,
    fontSize: 20
  },
  dueMeta: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 11,
    marginTop: 2
  },
  unpaidMeta: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 11,
    marginTop: 2
  },
  unpaidMetaAlert: {
    color: colors.danger,
    fontFamily: fontFamily.bold
  }
});
