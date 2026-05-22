import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamily, radius, spacing } from "../theme";

export type NavKey = "home" | "customers" | "employees" | "attendance" | "settings";

export type NavItem = {
  key: NavKey;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  activeIcon: React.ComponentProps<typeof Ionicons>["name"];
};

interface SideDrawerProps {
  visible: boolean;
  activeKey: NavKey;
  items: NavItem[];
  adminName: string;
  onSelect: (key: NavKey) => void;
  onClose: () => void;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "Home", icon: "home-outline", activeIcon: "home" },
  { key: "customers", label: "Customers", icon: "people-outline", activeIcon: "people" },
  { key: "employees", label: "Employees", icon: "briefcase-outline", activeIcon: "briefcase" },
  { key: "attendance", label: "Attendance", icon: "calendar-outline", activeIcon: "calendar" },
  { key: "settings", label: "Settings", icon: "settings-outline", activeIcon: "settings" }
];

export const getNavLabel = (key: NavKey) => NAV_ITEMS.find((item) => item.key === key)?.label || "Home";

export const SideDrawer: React.FC<SideDrawerProps> = ({
  visible,
  activeKey,
  items,
  adminName,
  onSelect,
  onClose
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <Text style={styles.brand}>Payment Hub</Text>
          <Text style={styles.admin}>{adminName}</Text>

          <View style={styles.nav}>
            {items.map((item) => {
              const active = item.key === activeKey;
              return (
                <Pressable
                  key={item.key}
                  style={[styles.navItem, active ? styles.navItemActive : null]}
                  onPress={() => {
                    onSelect(item.key);
                    onClose();
                  }}
                >
                  <Ionicons
                    name={active ? item.activeIcon : item.icon}
                    size={22}
                    color={active ? colors.accentStrong : colors.textMuted}
                  />
                  <Text style={[styles.navLabel, active ? styles.navLabelActive : null]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Pressable style={styles.backdrop} onPress={onClose} />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: "row"
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(24,50,74,0.45)"
  },
  panel: {
    width: 280,
    maxWidth: "85%",
    backgroundColor: colors.card,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    shadowColor: "#123050",
    shadowOpacity: 0.15,
    shadowOffset: { width: 4, height: 0 },
    shadowRadius: 12,
    elevation: 8
  },
  brand: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 20
  },
  admin: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    marginTop: 4,
    marginBottom: spacing.lg
  },
  nav: {
    gap: spacing.xs
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md
  },
  navItemActive: {
    backgroundColor: "#EAF2FF"
  },
  navLabel: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 16
  },
  navLabelActive: {
    color: colors.accentStrong,
    fontFamily: fontFamily.bold
  }
});
