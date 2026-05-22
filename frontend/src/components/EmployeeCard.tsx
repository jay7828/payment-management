import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EmployeeCardData } from "../types";
import { colors, fontFamily, radius, spacing } from "../theme";

interface EmployeeCardProps {
  employee: EmployeeCardData;
  onPress: () => void;
  fullWidth?: boolean;
}

const fmt = (n: number) => `₹${n.toFixed(0)}`;

export const EmployeeCard: React.FC<EmployeeCardProps> = ({ employee, onPress, fullWidth }) => {
  const netColor = employee.netPayable >= 0 ? colors.success : colors.danger;

  return (
    <Pressable style={[styles.card, fullWidth ? styles.cardFull : null]} onPress={onPress}>
      <View style={styles.top}>
        <Text style={styles.name} numberOfLines={1}>
          {employee.name}
        </Text>
        <Text style={styles.salary}>{fmt(employee.monthlySalary)}/mo</Text>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.label}>Earned</Text>
          <Text style={styles.value}>{fmt(employee.earnedPay)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.label}>Advance</Text>
          <Text style={[styles.value, { color: colors.warning }]}>{fmt(employee.totalAdvances)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.label}>Pay</Text>
          <Text style={[styles.value, { color: netColor }]}>{fmt(employee.netPayable)}</Text>
        </View>
      </View>

      <Text style={styles.meta}>
        P{employee.attendance.presentDays} · A{employee.attendance.absentDays} · {employee.advanceCount} adv
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    minWidth: 260
  },
  cardFull: {
    width: "100%",
    minWidth: 0
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm
  },
  name: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 17
  },
  salary: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 12
  },
  stats: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  stat: { alignItems: "flex-start" },
  label: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 10,
    textTransform: "uppercase"
  },
  value: {
    marginTop: 2,
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 15
  },
  meta: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 11
  }
});
