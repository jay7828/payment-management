import { StatusBar } from "expo-status-bar";
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { CustomersScreen } from "./src/screens/CustomersScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { colors, fontFamily, radius, spacing } from "./src/theme";
import { useBreakpoint } from "./src/hooks/useBreakpoint";

type TabKey = "home" | "customers" | "settings";

type TabItem = {
  key: TabKey;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  activeIcon: React.ComponentProps<typeof Ionicons>["name"];
};

const TAB_ITEMS: TabItem[] = [
  { key: "home", label: "Home", icon: "home-outline", activeIcon: "home" },
  { key: "customers", label: "Customers", icon: "people-outline", activeIcon: "people" },
  { key: "settings", label: "Settings", icon: "settings-outline", activeIcon: "settings" }
];

const AuthenticatedApp: React.FC = () => {
  const { admin, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [refreshKey, setRefreshKey] = useState(0);
  const [focusCustomerId, setFocusCustomerId] = useState<string | null>(null);
  const { isDesktop } = useBreakpoint();

  const triggerRefresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  const openCustomerDetails = useCallback((customerId: string) => {
    setFocusCustomerId(customerId);
    setActiveTab("customers");
  }, []);

  const handleFocusHandled = useCallback(() => {
    setFocusCustomerId(null);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (activeTab !== "home") {
        setActiveTab("home");
        return true;
      }
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [activeTab]);

  if (isDesktop) {
    return (
      <View style={desktopStyles.root}>
        <StatusBar style="dark" />
        {/* Sidebar */}
        <View style={desktopStyles.sidebar}>
          <View style={desktopStyles.sidebarBrand}>
            <Text style={desktopStyles.brandEyebrow}>Admin Console</Text>
            <Text style={desktopStyles.brandTitle}>Payment Command Center</Text>
          </View>

          <View style={desktopStyles.sidebarNav}>
            {TAB_ITEMS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  style={[desktopStyles.navItem, active ? desktopStyles.navItemActive : null]}
                  onPress={() => setActiveTab(tab.key)}
                  accessibilityRole="button"
                  accessibilityLabel={tab.label}
                >
                  <Ionicons
                    name={active ? tab.activeIcon : tab.icon}
                    size={20}
                    color={active ? colors.accentStrong : colors.textMuted}
                  />
                  <Text style={[desktopStyles.navLabel, active ? desktopStyles.navLabelActive : null]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={desktopStyles.sidebarFooter}>
            <View style={desktopStyles.adminPill}>
              <Ionicons name="person-circle-outline" size={16} color={colors.textMuted} />
              <Text style={desktopStyles.adminText}>{admin?.username || "admin"}</Text>
            </View>
          </View>
        </View>

        {/* Main content */}
        <View style={desktopStyles.main}>
          <View style={desktopStyles.contentInner}>
            {activeTab === "home" ? <HomeScreen refreshKey={refreshKey} onOpenCustomer={openCustomerDetails} /> : null}
            {activeTab === "customers" ? (
              <CustomersScreen
                refreshKey={refreshKey}
                onDataChange={triggerRefresh}
                focusCustomerId={focusCustomerId}
                onFocusHandled={handleFocusHandled}
              />
            ) : null}
            {activeTab === "settings" ? <SettingsScreen refreshKey={refreshKey} onLogout={logout} /> : null}
          </View>
        </View>
      </View>
    );
  }

  // Mobile layout (original)
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Admin Console</Text>
          <Text style={styles.title}>Payment Command Center</Text>
        </View>
        <View style={styles.adminPill}>
          <Text style={styles.adminText}>{admin?.username || "admin"}</Text>
        </View>
      </View>

      <View style={styles.body}>
        {activeTab === "home" ? <HomeScreen refreshKey={refreshKey} onOpenCustomer={openCustomerDetails} /> : null}

        {activeTab === "customers" ? (
          <CustomersScreen
            refreshKey={refreshKey}
            onDataChange={triggerRefresh}
            focusCustomerId={focusCustomerId}
            onFocusHandled={handleFocusHandled}
          />
        ) : null}

        {activeTab === "settings" ? <SettingsScreen refreshKey={refreshKey} onLogout={logout} /> : null}
      </View>

      <View style={styles.tabBarShell}>
        <View style={styles.tabBar}>
          {TAB_ITEMS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                style={[styles.tabButton, active ? styles.tabButtonActive : null]}
                onPress={() => setActiveTab(tab.key)}
                accessibilityRole="button"
                accessibilityLabel={tab.label}
              >
                <Ionicons
                  name={active ? tab.activeIcon : tab.icon}
                  size={23}
                  color={active ? colors.accentStrong : colors.textMuted}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
};

const AppRoot: React.FC = () => {
  const { isLoading, token, login } = useAuth();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingScreen} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <ActivityIndicator color={colors.accentStrong} size="large" />
        <Text style={styles.loadingText}>Loading workspace...</Text>
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <>
        <StatusBar style="dark" />
        <LoginScreen onLogin={login} />
      </>
    );
  }

  return <AuthenticatedApp />;
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppRoot />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

// ─── Desktop styles ────────────────────────────────────────────────────────────

const desktopStyles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: colors.background
  },
  sidebar: {
    width: 240,
    backgroundColor: colors.card,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    justifyContent: "space-between"
  },
  sidebarBrand: {
    marginBottom: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  brandEyebrow: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1
  },
  brandTitle: {
    marginTop: 6,
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 16,
    lineHeight: 22
  },
  sidebarNav: {
    flex: 1,
    gap: spacing.xs
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "transparent"
  },
  navItemActive: {
    backgroundColor: "#EAF2FF",
    borderColor: "#B8D4F8"
  },
  navLabel: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 14
  },
  navLabelActive: {
    color: colors.accentStrong,
    fontFamily: fontFamily.bold
  },
  sidebarFooter: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  adminPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 999
  },
  adminText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.medium,
    fontSize: 13
  },
  main: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: "hidden"
  },
  contentInner: {
    flex: 1,
    maxWidth: 1100,
    width: "100%",
    alignSelf: "center"
  }
});

// ─── Mobile styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    gap: spacing.sm
  },
  loadingText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.medium,
    fontSize: 13
  },
  header: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    shadowColor: "#123050",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  eyebrow: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1
  },
  title: {
    marginTop: 4,
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 21
  },
  adminPill: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 999
  },
  adminText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.medium,
    fontSize: 12
  },
  body: {
    flex: 1
  },
  tabBarShell: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background
  },
  tabBar: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    shadowColor: "#123050",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3
  },
  tabButton: {
    flex: 1,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  tabButtonActive: {
    backgroundColor: "#E7F2FF",
    borderColor: colors.accentStrong
  },
  tabTextActive: {
    color: colors.accentStrong,
    fontFamily: fontFamily.bold
  }
});
