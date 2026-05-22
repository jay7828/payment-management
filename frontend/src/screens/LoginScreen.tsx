import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getApiError } from "../api/client";
import { colors, fontFamily, radius, spacing } from "../theme";
import { useBreakpoint } from "../hooks/useBreakpoint";

interface LoginScreenProps {
  onLogin: (username: string, password: string) => Promise<void>;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isDesktop } = useBreakpoint();

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError("Enter username and password");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onLogin(username.trim(), password);
    } catch (loginError) {
      setError(getApiError(loginError));
    } finally {
      setSubmitting(false);
    }
  };

  if (isDesktop) {
    return (
      <LinearGradient colors={["#F4F8FF", "#EAF3FF", "#DDEBFF"]} style={desktopStyles.container}>
        <View style={desktopStyles.splitLayout}>
          {/* Left branding panel */}
          <View style={desktopStyles.brandPanel}>
            <Text style={desktopStyles.brandEyebrow}>Dukaan Ledger</Text>
            <Text style={desktopStyles.brandHeading}>Payment{"\n"}Command{"\n"}Center</Text>
            <Text style={desktopStyles.brandTagline}>
              Track customer balances, bills, and monthly collections — all in one place.
            </Text>
            <View style={desktopStyles.featureList}>
              {["Live due tracking", "Monthly collection reports", "Bill & payment history", "WhatsApp reminders"].map((f) => (
                <View key={f} style={desktopStyles.featureItem}>
                  <View style={desktopStyles.featureDot} />
                  <Text style={desktopStyles.featureText}>{f}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Right login panel */}
          <View style={desktopStyles.loginPanel}>
            <Text style={desktopStyles.loginEyebrow}>Admin Access</Text>
            <Text style={desktopStyles.loginTitle}>Sign in to your workspace</Text>
            <Text style={desktopStyles.loginSubtitle}>Secure single-admin login for billing management.</Text>

            <View style={desktopStyles.form}>
              <TextInput
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Admin username"
                placeholderTextColor="#7B8CA2"
                style={desktopStyles.input}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Password"
                placeholderTextColor="#7B8CA2"
                style={desktopStyles.input}
              />

              {error ? <Text style={desktopStyles.error}>{error}</Text> : null}

              <Pressable
                style={[desktopStyles.button, submitting ? desktopStyles.buttonDisabled : null]}
                onPress={handleLogin}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.textOnDark} />
                ) : (
                  <Text style={desktopStyles.buttonText}>Sign In</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </LinearGradient>
    );
  }

  // Mobile layout (original)
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <LinearGradient colors={["#F4F8FF", "#EAF3FF", "#DDEBFF"]} style={styles.container}>
        <View style={styles.panel}>
          <Text style={styles.eyebrow}>Admin Access</Text>
          <Text style={styles.title}>Shop Payment Manager</Text>
          <Text style={styles.subtitle}>Single-admin secure login for customer billing and monthly collections.</Text>

          <View style={styles.form}>
            <TextInput
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Admin username"
              placeholderTextColor="#7B8CA2"
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Password"
              placeholderTextColor="#7B8CA2"
              style={styles.input}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable style={[styles.button, submitting ? styles.buttonDisabled : null]} onPress={handleLogin} disabled={submitting}>
              {submitting ? <ActivityIndicator color={colors.textOnDark} /> : <Text style={styles.buttonText}>Login</Text>}
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
};

// ─── Desktop styles ─────────────────────────────────────────────────────────

const desktopStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  splitLayout: {
    flexDirection: "row",
    width: "100%",
    maxWidth: 900,
    minHeight: 540,
    borderRadius: radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#294C75",
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 5,
    marginHorizontal: spacing.xl
  },
  brandPanel: {
    flex: 1,
    backgroundColor: colors.accentStrong,
    padding: 40,
    justifyContent: "center",
    gap: spacing.lg
  },
  brandEyebrow: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: fontFamily.medium,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.5
  },
  brandHeading: {
    color: "#FFFFFF",
    fontFamily: fontFamily.bold,
    fontSize: 42,
    lineHeight: 50
  },
  brandTagline: {
    color: "rgba(255,255,255,0.8)",
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 280
  },
  featureList: {
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.6)"
  },
  featureText: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: fontFamily.medium,
    fontSize: 14
  },
  loginPanel: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 40,
    justifyContent: "center",
    gap: spacing.sm
  },
  loginEyebrow: {
    color: colors.accentStrong,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1
  },
  loginTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 28,
    lineHeight: 34,
    marginTop: spacing.xs
  },
  loginSubtitle: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.sm
  },
  form: {
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    color: colors.textPrimary,
    fontFamily: fontFamily.medium,
    backgroundColor: "#F8FBFF",
    fontSize: 15
  },
  error: {
    color: colors.danger,
    fontFamily: fontFamily.medium,
    fontSize: 13
  },
  button: {
    marginTop: spacing.sm,
    backgroundColor: colors.accentStrong,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center"
  },
  buttonDisabled: {
    opacity: 0.7
  },
  buttonText: {
    color: colors.textOnDark,
    fontFamily: fontFamily.bold,
    fontSize: 16
  }
});

// ─── Mobile styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F8FF"
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl
  },
  panel: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#294C75",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 3,
    gap: spacing.md
  },
  eyebrow: {
    color: colors.accentStrong,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 30,
    lineHeight: 35
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20
  },
  form: {
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    color: colors.textPrimary,
    fontFamily: fontFamily.medium,
    backgroundColor: "#FFFFFF"
  },
  error: {
    color: colors.danger,
    fontFamily: fontFamily.medium,
    fontSize: 13
  },
  button: {
    marginTop: spacing.sm,
    backgroundColor: colors.accentStrong,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center"
  },
  buttonDisabled: {
    opacity: 0.7
  },
  buttonText: {
    color: colors.textOnDark,
    fontFamily: fontFamily.bold,
    fontSize: 16
  }
});
