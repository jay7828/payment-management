import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getApiError } from "../api/client";
import { colors, fontFamily, radius, spacing } from "../theme";

interface LoginScreenProps {
  onLogin: (username: string, password: string) => Promise<void>;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
