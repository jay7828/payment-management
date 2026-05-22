import dayjs from "dayjs";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { api, getApiError } from "../api/client";
import { colors, fontFamily, radius, spacing } from "../theme";
import { MonthlyCollectionRow, SalesReport, Site } from "../types";
import {
  DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
  WHATSAPP_TEMPLATE_PLACEHOLDERS,
  loadWhatsAppTemplate,
  saveWhatsAppTemplate
} from "../utils/whatsappTemplate";

interface SettingsScreenProps {
  refreshKey: number;
  onLogout: () => Promise<void>;
}

interface MonthlyCollectionResponse {
  months: number;
  collection: MonthlyCollectionRow[];
}

type SettingsPage = "home" | "reports" | "salesReport" | "sites" | "whatsapp";

interface SitesResponse {
  sites: Site[];
}

interface SalesReportResponse {
  report: SalesReport;
  emailConfigured: boolean;
  defaultRecipient: string;
}

const formatCurrency = (value: number) => `₹${value.toFixed(2)}`;

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ refreshKey, onLogout }) => {
  const [months, setMonths] = useState("6");
  const [activePage, setActivePage] = useState<SettingsPage>("home");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<MonthlyCollectionRow[]>([]);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [whatsAppTemplate, setWhatsAppTemplate] = useState(DEFAULT_WHATSAPP_MESSAGE_TEMPLATE);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateStatus, setTemplateStatus] = useState<string | null>(null);

  const [sites, setSites] = useState<Site[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [savingSite, setSavingSite] = useState(false);

  const [salesMonthKey, setSalesMonthKey] = useState(dayjs().format("YYYY-MM"));
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [reportEmail, setReportEmail] = useState("js758089@gmail.com");
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);

  const loadCollections = async () => {
    try {
      setLoading(true);
      setError(null);

      const monthCount = Number(months);
      const response = await api.get<MonthlyCollectionResponse>("/reports/monthly-collections", {
        params: {
          months: Number.isFinite(monthCount) && monthCount > 0 ? monthCount : 6
        }
      });

      const nextRows = response.data.collection;
      setRows(nextRows);
      setSelectedMonthKey((current) => {
        if (!nextRows.length) {
          return null;
        }
        if (current && nextRows.some((row) => row.monthKey === current)) {
          return current;
        }
        const lastRow = nextRows[nextRows.length - 1];
        return lastRow ? lastRow.monthKey : null;
      });
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activePage === "reports") {
      void loadCollections();
    }
  }, [refreshKey, activePage]);

  useEffect(() => {
    let mounted = true;

    const loadTemplate = async () => {
      try {
        const storedTemplate = await loadWhatsAppTemplate();
        if (mounted) {
          setWhatsAppTemplate(storedTemplate);
        }
      } catch (templateError) {
        if (mounted) {
          setWhatsAppTemplate(DEFAULT_WHATSAPP_MESSAGE_TEMPLATE);
          setTemplateStatus("Could not load saved template. Using default.");
        }
      } finally {
        if (mounted) {
          setTemplateLoading(false);
        }
      }
    };

    void loadTemplate();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (activePage !== "home") {
        setActivePage("home");
        return true;
      }

      return false;
    });

    return () => {
      subscription.remove();
    };
  }, [activePage]);

  const latestMonths = useMemo(() => [...rows].slice(-3).reverse(), [rows]);
  const allMonthsDescending = useMemo(() => [...rows].reverse(), [rows]);
  const selectedMonth = useMemo(
    () => rows.find((row) => row.monthKey === selectedMonthKey) || null,
    [rows, selectedMonthKey]
  );
  const selectedMonthIndex = useMemo(
    () => rows.findIndex((row) => row.monthKey === selectedMonthKey),
    [rows, selectedMonthKey]
  );
  const previousMonth = selectedMonthIndex > 0 ? rows[selectedMonthIndex - 1] : null;
  const totalCollectionRange = useMemo(
    () => rows.reduce((sum, row) => sum + row.totalCollection, 0),
    [rows]
  );

  const avgPerTransaction = selectedMonth
    ? selectedMonth.transactionCount > 0
      ? selectedMonth.totalCollection / selectedMonth.transactionCount
      : 0
    : 0;
  const selectedSharePercent =
    selectedMonth && totalCollectionRange > 0
      ? (selectedMonth.totalCollection / totalCollectionRange) * 100
      : 0;
  const monthChange = selectedMonth && previousMonth ? selectedMonth.totalCollection - previousMonth.totalCollection : null;
  const monthChangePercent =
    monthChange !== null && previousMonth && previousMonth.totalCollection > 0
      ? (monthChange / previousMonth.totalCollection) * 100
      : null;

  const loadSites = async () => {
    try {
      setSitesLoading(true);
      const response = await api.get<SitesResponse>("/sites");
      setSites(response.data.sites || []);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSitesLoading(false);
    }
  };

  const loadSalesReport = async (monthKeyOverride?: string) => {
    const monthKey = monthKeyOverride || salesMonthKey;
    try {
      setSalesLoading(true);
      setSalesError(null);
      const response = await api.get<SalesReportResponse>("/reports/sales-report", {
        params: { monthKey }
      });
      setSalesReport(response.data.report);
      setEmailConfigured(response.data.emailConfigured);
      setReportEmail(response.data.defaultRecipient || "js758089@gmail.com");
    } catch (requestError) {
      setSalesError(getApiError(requestError));
      setSalesReport(null);
    } finally {
      setSalesLoading(false);
    }
  };

  const handleAddSite = async () => {
    if (!newSiteName.trim()) {
      setError("Site name is required");
      return;
    }
    try {
      setSavingSite(true);
      setError(null);
      await api.post("/sites", { name: newSiteName.trim() });
      setNewSiteName("");
      await loadSites();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSavingSite(false);
    }
  };

  const handleSendSalesReport = async () => {
    try {
      setSendingReport(true);
      setSendStatus(null);
      setSalesError(null);
      const response = await api.post("/reports/sales-report/send", {
        monthKey: salesMonthKey,
        email: reportEmail.trim()
      });
      setSendStatus(response.data.message || "Report sent successfully.");
    } catch (requestError) {
      setSalesError(getApiError(requestError));
    } finally {
      setSendingReport(false);
    }
  };

  const handleOpenReportsPage = () => {
    setActivePage("reports");
    void loadCollections();
  };

  const handleOpenSalesReportPage = () => {
    setActivePage("salesReport");
    void loadSalesReport();
  };

  const handleOpenSitesPage = () => {
    setActivePage("sites");
    void loadSites();
  };

  const handleOpenWhatsAppPage = () => {
    setActivePage("whatsapp");
  };

  const salesMonthOptions = useMemo(() => {
    return Array.from({ length: 24 }, (_, index) =>
      dayjs().subtract(index, "month").format("YYYY-MM")
    );
  }, []);

  const handleBackToHome = () => {
    setActivePage("home");
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await onLogout();
    } finally {
      setLoggingOut(false);
    }
  };

  const handleSaveTemplate = async () => {
    try {
      setTemplateSaving(true);
      setTemplateStatus(null);
      const savedTemplate = await saveWhatsAppTemplate(whatsAppTemplate);
      setWhatsAppTemplate(savedTemplate);
      setTemplateStatus("WhatsApp message template saved.");
    } catch (templateError) {
      setTemplateStatus("Failed to save template.");
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleResetTemplate = async () => {
    try {
      setTemplateSaving(true);
      setTemplateStatus(null);
      const savedTemplate = await saveWhatsAppTemplate(DEFAULT_WHATSAPP_MESSAGE_TEMPLATE);
      setWhatsAppTemplate(savedTemplate);
      setTemplateStatus("Template reset to default.");
    } catch (templateError) {
      setTemplateStatus("Failed to reset template.");
    } finally {
      setTemplateSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {activePage === "home" ? (
        <>
          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>Settings</Text>
            <Text style={styles.heroTitle}>Workspace Controls</Text>
            <Text style={styles.heroSubtitle}>Open each tool on a separate page for a cleaner workflow.</Text>
          </View>

          <Pressable style={styles.navCard} onPress={handleOpenReportsPage}>
            <View style={styles.navCardBody}>
              <Text style={styles.navCardTitle}>Reports</Text>
              <Text style={styles.navCardSubtitle}>Monthly collection insights and trends.</Text>
            </View>
            <Text style={styles.navCardArrow}>›</Text>
          </Pressable>

          <Pressable style={styles.navCard} onPress={handleOpenSalesReportPage}>
            <View style={styles.navCardBody}>
              <Text style={styles.navCardTitle}>Sales Report Email</Text>
              <Text style={styles.navCardSubtitle}>Generate and email monthly sales reports.</Text>
            </View>
            <Text style={styles.navCardArrow}>›</Text>
          </Pressable>

          <Pressable style={styles.navCard} onPress={handleOpenSitesPage}>
            <View style={styles.navCardBody}>
              <Text style={styles.navCardTitle}>Sites</Text>
              <Text style={styles.navCardSubtitle}>Manage customer sites and default location.</Text>
            </View>
            <Text style={styles.navCardArrow}>›</Text>
          </Pressable>

          <Pressable style={styles.navCard} onPress={handleOpenWhatsAppPage}>
            <View style={styles.navCardBody}>
              <Text style={styles.navCardTitle}>WhatsApp Text</Text>
              <Text style={styles.navCardSubtitle}>Manage the reminder message template.</Text>
            </View>
            <Text style={styles.navCardArrow}>›</Text>
          </Pressable>

          <Pressable style={[styles.logoutButton, loggingOut ? styles.logoutButtonDisabled : null]} onPress={handleLogout}>
            <Text style={styles.logoutText}>{loggingOut ? "Logging out..." : "Logout"}</Text>
          </Pressable>
        </>
      ) : null}

      {activePage === "reports" ? (
        <>
          <View style={styles.pageHeaderCard}>
            <Pressable style={styles.backButton} onPress={handleBackToHome}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
            <Text style={styles.pageTitle}>Monthly Collection Report</Text>
            <Text style={styles.pageSubtitle}>Latest months are shown first. Tap any month to see detailed summary.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.filterRow}>
              <TextInput
                value={months}
                onChangeText={setMonths}
                keyboardType="number-pad"
                placeholder="Months"
                placeholderTextColor="#8094AF"
                style={styles.input}
              />
              <Pressable style={styles.refreshButton} onPress={() => void loadCollections()}>
                <Text style={styles.refreshButtonText}>Load</Text>
              </Pressable>
            </View>

            {loading ? <ActivityIndicator color={colors.accentStrong} style={{ marginTop: spacing.md }} /> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            {!rows.length && !loading ? <Text style={styles.emptyText}>No monthly report data available.</Text> : null}

            {latestMonths.length ? (
              <View style={styles.latestSection}>
                <Text style={styles.sectionLabel}>Latest Months</Text>
                <View style={styles.latestRow}>
                  {latestMonths.map((row) => {
                    const active = row.monthKey === selectedMonthKey;
                    return (
                      <Pressable
                        key={row.monthKey}
                        style={[styles.latestCard, active ? styles.latestCardActive : null]}
                        onPress={() => setSelectedMonthKey(row.monthKey)}
                      >
                        <Text style={[styles.latestMonth, active ? styles.latestMonthActive : null]}>
                          {dayjs(`${row.monthKey}-01`).format("MMM YYYY")}
                        </Text>
                        <Text style={[styles.latestAmount, active ? styles.latestAmountActive : null]}>
                          {formatCurrency(row.totalCollection)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {selectedMonth ? (
              <View style={styles.detailCard}>
                <Text style={styles.detailTitle}>{dayjs(`${selectedMonth.monthKey}-01`).format("MMMM YYYY")}</Text>
                <Text style={styles.detailLine}>Collection: {formatCurrency(selectedMonth.totalCollection)}</Text>
                <Text style={styles.detailLine}>Transactions: {selectedMonth.transactionCount}</Text>
                <Text style={styles.detailLine}>Average per transaction: {formatCurrency(avgPerTransaction)}</Text>
                <Text style={styles.detailLine}>Share in selected range: {selectedSharePercent.toFixed(1)}%</Text>
                {monthChange !== null ? (
                  <Text style={styles.detailLine}>
                    Vs previous month: {monthChange >= 0 ? "+" : ""}
                    {formatCurrency(monthChange)}
                    {monthChangePercent !== null
                      ? ` (${monthChangePercent >= 0 ? "+" : ""}${monthChangePercent.toFixed(1)}%)`
                      : ""}
                  </Text>
                ) : (
                  <Text style={styles.detailLine}>Vs previous month: Not available</Text>
                )}
              </View>
            ) : null}

            <Text style={styles.sectionLabel}>All Months</Text>
            <View style={styles.list}>
              {allMonthsDescending.map((row) => {
                const active = row.monthKey === selectedMonthKey;
                return (
                  <Pressable
                    style={[styles.row, active ? styles.rowActive : null]}
                    key={row.monthKey}
                    onPress={() => setSelectedMonthKey(row.monthKey)}
                  >
                    <View>
                      <Text style={styles.month}>{dayjs(`${row.monthKey}-01`).format("MMM YYYY")}</Text>
                      <Text style={styles.transactions}>{row.transactionCount} transactions</Text>
                    </View>
                    <Text style={styles.amount}>{formatCurrency(row.totalCollection)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </>
      ) : null}

      {activePage === "sites" ? (
        <>
          <View style={styles.pageHeaderCard}>
            <Pressable style={styles.backButton} onPress={handleBackToHome}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
            <Text style={styles.pageTitle}>Sites</Text>
            <Text style={styles.pageSubtitle}>Create sites and assign customers when adding new entries.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.filterRow}>
              <TextInput
                value={newSiteName}
                onChangeText={setNewSiteName}
                placeholder="New site name"
                placeholderTextColor="#8094AF"
                style={styles.input}
              />
              <Pressable
                style={[styles.refreshButton, savingSite ? styles.buttonDisabled : null]}
                onPress={() => void handleAddSite()}
                disabled={savingSite}
              >
                <Text style={styles.refreshButtonText}>{savingSite ? "..." : "Add"}</Text>
              </Pressable>
            </View>

            {sitesLoading ? <ActivityIndicator color={colors.accentStrong} style={{ marginTop: spacing.md }} /> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.list}>
              {sites.map((site) => (
                <View key={site.id} style={styles.row}>
                  <View>
                    <Text style={styles.month}>{site.name}</Text>
                    <Text style={styles.transactions}>{site.isDefault ? "Default site" : "Custom site"}</Text>
                  </View>
                  {site.isDefault ? <Text style={styles.defaultBadge}>Default</Text> : null}
                </View>
              ))}
            </View>
          </View>
        </>
      ) : null}

      {activePage === "salesReport" ? (
        <>
          <View style={styles.pageHeaderCard}>
            <Pressable style={styles.backButton} onPress={handleBackToHome}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
            <Text style={styles.pageTitle}>Monthly Sales Report</Text>
            <Text style={styles.pageSubtitle}>
              Preview monthly sales data and send the report by email.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Select Month</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthPickerRow}>
              {salesMonthOptions.map((monthKey) => {
                const active = salesMonthKey === monthKey;
                return (
                  <Pressable
                    key={monthKey}
                    style={[styles.monthPickerChip, active ? styles.monthPickerChipActive : null]}
                    onPress={() => {
                      setSalesMonthKey(monthKey);
                      void loadSalesReport(monthKey);
                    }}
                  >
                    <Text style={[styles.monthPickerText, active ? styles.monthPickerTextActive : null]}>
                      {dayjs(`${monthKey}-01`).format("MMM YY")}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable style={styles.refreshButton} onPress={() => void loadSalesReport()}>
              <Text style={styles.refreshButtonText}>{salesLoading ? "Loading..." : "Load Report"}</Text>
            </Pressable>

            {salesError ? <Text style={styles.error}>{salesError}</Text> : null}
            {sendStatus ? <Text style={styles.templateStatus}>{sendStatus}</Text> : null}

            {salesReport ? (
              <View style={styles.detailCard}>
                <Text style={styles.detailTitle}>{salesReport.monthLabel}</Text>
                <Text style={styles.detailLine}>Collection: {formatCurrency(salesReport.sales.totalCollection)}</Text>
                <Text style={styles.detailLine}>Transactions: {salesReport.sales.transactionCount}</Text>
                <Text style={styles.detailLine}>Bills created: {salesReport.billing.billsCreated}</Text>
                <Text style={styles.detailLine}>Total billed: {formatCurrency(salesReport.billing.totalBilled)}</Text>
                <Text style={styles.detailLine}>Bill due: {formatCurrency(salesReport.billing.totalBillDue)}</Text>
                <Text style={styles.detailLine}>New customers: {salesReport.customers.newCustomers}</Text>
                <Text style={styles.detailLine}>
                  Outstanding due: {formatCurrency(salesReport.customers.totalOutstandingDue)}
                </Text>
                <Text style={styles.detailLine}>
                  Attendance marked: {salesReport.attendance.recordsMarked} (P {salesReport.attendance.present} / A{" "}
                  {salesReport.attendance.absent})
                </Text>
              </View>
            ) : null}

            <Text style={styles.sectionLabel}>Send Report</Text>
            <TextInput
              value={reportEmail}
              onChangeText={setReportEmail}
              placeholder="Recipient email"
              placeholderTextColor="#8094AF"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
            {!emailConfigured ? (
              <Text style={styles.warningHint}>
                Email is not configured on server. Add SMTP_HOST, SMTP_USER, and SMTP_PASS in backend .env.
              </Text>
            ) : null}
            <Pressable
              style={[styles.primaryButton, sendingReport || !emailConfigured ? styles.buttonDisabled : null]}
              onPress={() => void handleSendSalesReport()}
              disabled={sendingReport || !emailConfigured}
            >
              <Text style={styles.primaryButtonText}>
                {sendingReport ? "Sending..." : `Send ${dayjs(`${salesMonthKey}-01`).format("MMM YYYY")} Report`}
              </Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {activePage === "whatsapp" ? (
        <>
          <View style={styles.pageHeaderCard}>
            <Pressable style={styles.backButton} onPress={handleBackToHome}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
            <Text style={styles.pageTitle}>WhatsApp Reminder Message</Text>
            <Text style={styles.pageSubtitle}>Customize the message template used in customer share action.</Text>
          </View>

          <View style={styles.card}>
            {templateLoading ? <ActivityIndicator color={colors.accentStrong} style={{ marginTop: spacing.md }} /> : null}

            {!templateLoading ? (
              <>
                <TextInput
                  value={whatsAppTemplate}
                  onChangeText={(value) => {
                    setWhatsAppTemplate(value);
                    if (templateStatus) {
                      setTemplateStatus(null);
                    }
                  }}
                  multiline
                  numberOfLines={8}
                  textAlignVertical="top"
                  placeholder="Type WhatsApp reminder message"
                  placeholderTextColor="#8094AF"
                  style={styles.templateInput}
                />

                <Text style={styles.templateHint}>Placeholders: {WHATSAPP_TEMPLATE_PLACEHOLDERS}</Text>
                {templateStatus ? <Text style={styles.templateStatus}>{templateStatus}</Text> : null}

                <View style={styles.templateActions}>
                  <Pressable
                    style={[styles.secondaryButton, templateSaving ? styles.buttonDisabled : null]}
                    onPress={handleResetTemplate}
                    disabled={templateSaving}
                  >
                    <Text style={styles.secondaryButtonText}>Reset</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.primaryButton, templateSaving ? styles.buttonDisabled : null]}
                    onPress={handleSaveTemplate}
                    disabled={templateSaving}
                  >
                    <Text style={styles.primaryButtonText}>{templateSaving ? "Saving..." : "Save"}</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </>
      ) : null}
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    shadowColor: "#123050",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2
  },
  heroEyebrow: {
    color: colors.accentStrong,
    fontFamily: fontFamily.bold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontSize: 11
  },
  heroTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 24,
    marginTop: 4
  },
  heroSubtitle: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    marginTop: 6,
    lineHeight: 19
  },
  navCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#123050",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1
  },
  navCardBody: {
    flex: 1,
    paddingRight: spacing.md
  },
  navCardTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 18
  },
  navCardSubtitle: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18
  },
  navCardArrow: {
    color: colors.accentStrong,
    fontFamily: fontFamily.bold,
    fontSize: 30,
    marginTop: -2
  },
  pageHeaderCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: "#123050",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1
  },
  backButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14
  },
  backButtonText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 13
  },
  pageTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 22
  },
  pageSubtitle: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 19
  },
  optionCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  optionCardActive: {
    borderColor: colors.accentStrong,
    backgroundColor: "#F1F8FF"
  },
  optionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 20
  },
  optionSubtitle: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    marginTop: 4,
    fontSize: 13
  },
  optionAction: {
    color: colors.accentStrong,
    fontFamily: fontFamily.bold,
    fontSize: 13,
    borderWidth: 1,
    borderColor: "#BCD4EE",
    backgroundColor: "#EAF3FF",
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14
  },
  optionActionActive: {
    borderColor: colors.accentStrong,
    backgroundColor: "#DCEEFF"
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: "#123050",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 22
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 19
  },
  filterRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontFamily: fontFamily.medium,
    color: colors.textPrimary,
    backgroundColor: "#FFFFFF"
  },
  refreshButton: {
    backgroundColor: colors.accentStrong,
    borderRadius: radius.md,
    justifyContent: "center",
    paddingHorizontal: spacing.lg
  },
  refreshButtonText: {
    color: colors.textOnDark,
    fontFamily: fontFamily.bold,
    fontSize: 14
  },
  error: {
    color: colors.danger,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    marginTop: spacing.sm
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    marginTop: spacing.sm
  },
  latestSection: {
    marginTop: spacing.sm,
    gap: spacing.sm
  },
  sectionLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 15,
    marginTop: spacing.sm
  },
  latestRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  latestCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.cardSoft
  },
  latestCardActive: {
    borderColor: colors.accentStrong,
    backgroundColor: "#E7F2FF"
  },
  latestMonth: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 13
  },
  latestMonthActive: {
    color: colors.accentStrong
  },
  latestAmount: {
    color: colors.success,
    fontFamily: fontFamily.bold,
    fontSize: 14,
    marginTop: 4
  },
  latestAmountActive: {
    color: colors.accentStrong
  },
  detailCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.cardSoft,
    marginTop: spacing.sm,
    gap: 4
  },
  detailTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 16,
    marginBottom: 4
  },
  detailLine: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 12
  },
  list: {
    marginTop: spacing.sm,
    gap: spacing.sm
  },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  rowActive: {
    borderColor: colors.accentStrong,
    backgroundColor: "#EDF5FF"
  },
  month: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 15
  },
  transactions: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    marginTop: 3,
    fontSize: 12
  },
  amount: {
    color: colors.success,
    fontFamily: fontFamily.bold,
    fontSize: 18
  },
  templateInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontFamily: fontFamily.medium,
    color: colors.textPrimary,
    backgroundColor: "#FFFFFF",
    minHeight: 130
  },
  templateHint: {
    color: colors.textMuted,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm
  },
  templateStatus: {
    color: colors.accentStrong,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    marginTop: spacing.xs
  },
  templateActions: {
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
    backgroundColor: colors.surface
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 13
  },
  primaryButton: {
    backgroundColor: colors.accentStrong,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md
  },
  primaryButtonText: {
    color: colors.textOnDark,
    fontFamily: fontFamily.bold,
    fontSize: 13
  },
  buttonDisabled: {
    opacity: 0.7
  },
  logoutButton: {
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center"
  },
  logoutButtonDisabled: {
    opacity: 0.7
  },
  logoutText: {
    color: colors.textOnDark,
    fontFamily: fontFamily.bold,
    fontSize: 16
  },
  monthPickerRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs
  },
  monthPickerChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 8
  },
  monthPickerChipActive: {
    backgroundColor: colors.accentStrong,
    borderColor: colors.accentStrong
  },
  monthPickerText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.medium,
    fontSize: 12
  },
  monthPickerTextActive: {
    color: colors.textOnDark,
    fontFamily: fontFamily.bold
  },
  defaultBadge: {
    color: colors.accentStrong,
    fontFamily: fontFamily.bold,
    fontSize: 12
  },
  warningHint: {
    color: colors.warning,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 17
  }
});
