import dayjs from "dayjs";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CustomerCardData } from "../types";
import { colors, fontFamily, radius, spacing } from "../theme";

interface CustomerCardProps {
  customer: CustomerCardData;
  onPress: () => void;
}

export const CustomerCard: React.FC<CustomerCardProps> = ({ customer, onPress }) => {
  const badgeStyle =
    customer.currentMonthStatus === "PAID"
      ? [styles.badge, { backgroundColor: "#D9F3EF", borderColor: "#B5E7DE" }]
      : [styles.badge, { backgroundColor: "#FFE8D2", borderColor: "#F7CC9D" }];

  const badgeTextColor = customer.currentMonthStatus === "PAID" ? colors.success : colors.warning;
  const statusDate = customer.statusDate ? dayjs(customer.statusDate).format("DD MMM YYYY") : "-";
  const dueAmountColor =
    customer.totalDue <= 0
      ? colors.success
      : customer.unpaidBillsCount > 1 && customer.unpaidBillsCount < 3
        ? colors.warning
        : colors.danger;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.headerRow}>
        <View style={styles.nameWrap}>
          <Text style={styles.name}>{customer.name}</Text>
          <Text style={styles.mobile}>{customer.mobile}</Text>
        </View>
        <View style={badgeStyle}>
          <Text style={[styles.badgeText, { color: badgeTextColor }]}>
            {customer.currentMonthStatus} • {statusDate}
          </Text>
        </View>
      </View>

      <Text style={styles.address} numberOfLines={2}>
        {customer.address || "No address added"}
      </Text>

      <View style={styles.amountRow}>
        <View>
          <Text style={styles.amountLabel}>Due Amount</Text>
          <Text style={[styles.amountValue, { color: dueAmountColor }]}>₹
            {customer.totalDue.toFixed(2)}
          </Text>
        </View>
        <View style={styles.balanceWrap}>
          <Text style={styles.balanceLabel}>Previous Balance</Text>
          <Text style={styles.balanceValue}>₹{customer.previousBalance.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.unpaidRow}>
        <Text
          style={[
            styles.unpaidCount,
            customer.unpaidBillsCount > 3 ? styles.unpaidCountAlert : null
          ]}
        >
          Unpaid Bills: {customer.unpaidBillsCount}
        </Text>
        <Text style={styles.unpaidTotal}>Bills Unpaid ₹{customer.totalUnpaidBillAmount.toFixed(2)}</Text>
      </View>

      {customer.unpaidBillsCount > 3 ? <Text style={styles.warningText}>More than 3 bills are unpaid.</Text> : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  nameWrap: {
    flexShrink: 1
  },
  name: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 18
  },
  mobile: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    marginTop: 2
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: "55%"
  },
  badgeText: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    textAlign: "center"
  },
  address: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 13
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end"
  },
  amountLabel: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  amountValue: {
    marginTop: 4,
    fontFamily: fontFamily.bold,
    fontSize: 22
  },
  balanceWrap: {
    alignItems: "flex-end"
  },
  balanceLabel: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  balanceValue: {
    marginTop: 4,
    color: colors.textPrimary,
    fontFamily: fontFamily.medium,
    fontSize: 14
  },
  unpaidRow: {
    marginTop: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  unpaidCount: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 12
  },
  unpaidCountAlert: {
    color: colors.danger,
    fontFamily: fontFamily.bold
  },
  unpaidTotal: {
    color: colors.textPrimary,
    fontFamily: fontFamily.medium,
    fontSize: 12
  },
  warningText: {
    color: colors.danger,
    fontFamily: fontFamily.bold,
    fontSize: 12
  }
});
