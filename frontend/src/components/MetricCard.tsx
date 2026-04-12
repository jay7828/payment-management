import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fontFamily, radius, spacing } from "../theme";

interface MetricCardProps {
  label: string;
  value: string;
  accentColor?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({ label, value, accentColor }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, accentColor ? { color: accentColor } : null]}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border
  },
  label: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  value: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 25
  }
});
