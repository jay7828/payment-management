import { StatusBar } from "expo-status-bar";
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { CustomersScreen } from "./src/screens/CustomersScreen";
import { EmployeesScreen } from "./src/screens/EmployeesScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { AttendanceScreen } from "./src/screens/AttendanceScreen";
import { NAV_ITEMS, NavKey, SideDrawer, getNavLabel } from "./src/components/SideDrawer";
import { colors, fontFamily, radius, spacing } from "./src/theme";
import { useBreakpoint } from "./src/hooks/useBreakpoint";

const AuthenticatedApp: React.FC = () => {
  const { admin, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<NavKey>("home");
  const [refreshKey, setRefreshKey] = useState(0);
  const [focusCustomerId, setFocusCustomerId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
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
    if (Platform.OS !== "android") return;

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (menuOpen) {
        setMenuOpen(false);
        return true;
      }
      if (activeTab !== "home") {
        setActiveTab("home");
        return true;
      }
      return true;
    });

    return () => subscription.remove();
  }, [activeTab, menuOpen]);

  const renderScreen = () => {
    switch (activeTab) {
      case "home":
        return <HomeScreen refreshKey={refreshKey} onOpenCustomer={openCustomerDetails} />;
      case "customers":
        return (
          <CustomersScreen
            refreshKey={refreshKey}
            onDataChange={triggerRefresh}
            focusCustomerId={focusCustomerId}
            onFocusHandled={handleFocusHandled}
          />
        );
      case "employees":
        return <EmployeesScreen refreshKey={refreshKey} onDataChange={triggerRefresh} />;
      case "attendance":
        return <AttendanceScreen refreshKey={refreshKey} />;
      case "settings":
        return <SettingsScreen refreshKey={refreshKey} onLogout={logout} />;
      default:
        return null;
    }
  };

  if (isDesktop) {
    return (
      <View style={desktopStyles.root}>
        <StatusBar style="dark" />
        <View style={desktopStyles.sidebar}>
          <Text style={desktopStyles.brand}>Payment Hub</Text>
          <View style={desktopStyles.sidebarNav}>
            {NAV_ITEMS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  style={[desktopStyles.navItem, active ? desktopStyles.navItemActive : null]}
                  onPress={() => setActiveTab(tab.key)}
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
          <Text style={desktopStyles.adminText}>{admin?.username || "admin"}</Text>
        </View>
        <View style={desktopStyles.main}>
          <View style={desktopStyles.contentInner}>{renderScreen()}</View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={mobileStyles.root} edges={["top", "bottom"]}>
      <StatusBar style="dark" />

      <View style={mobileStyles.topBar}>
        <Pressable style={mobileStyles.menuBtn} onPress={() => setMenuOpen(true)} hitSlop={8}>
          <Ionicons name="menu" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={mobileStyles.pageTitle}>{getNavLabel(activeTab)}</Text>
        <View style={mobileStyles.menuBtn} />
      </View>

      <View style={mobileStyles.body}>{renderScreen()}</View>

      <SideDrawer
        visible={menuOpen}
        activeKey={activeTab}
        items={NAV_ITEMS}
        adminName={admin?.username || "admin"}
        onSelect={setActiveTab}
        onClose={() => setMenuOpen(false)}
      />
    </SafeAreaView>
  );
};

const AppRoot: React.FC = () => {
  const { isLoading, token, login } = useAuth();

  if (isLoading) {
    return (
      <SafeAreaView style={mobileStyles.loadingScreen} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <ActivityIndicator color={colors.accentStrong} size="large" />
        <Text style={mobileStyles.loadingText}>Loading...</Text>
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

const desktopStyles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", backgroundColor: colors.background },
  sidebar: {
    width: 220,
    backgroundColor: colors.card,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    justifyContent: "space-between"
  },
  brand: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 18,
    marginBottom: spacing.lg
  },
  sidebarNav: { flex: 1, gap: spacing.xs },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.md
  },
  navItemActive: { backgroundColor: "#EAF2FF" },
  navLabel: { color: colors.textMuted, fontFamily: fontFamily.medium, fontSize: 14 },
  navLabelActive: { color: colors.accentStrong, fontFamily: fontFamily.bold },
  adminText: { color: colors.textMuted, fontFamily: fontFamily.medium, fontSize: 12 },
  main: { flex: 1, backgroundColor: colors.background },
  contentInner: { flex: 1, maxWidth: 1100, width: "100%", alignSelf: "center" }
});

const mobileStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    gap: spacing.sm
  },
  loadingText: { color: colors.textPrimary, fontFamily: fontFamily.medium, fontSize: 13 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card
  },
  menuBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  pageTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 17
  },
  body: { flex: 1, minHeight: 0 }
});
