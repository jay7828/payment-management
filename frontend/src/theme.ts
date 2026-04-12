import { Platform } from "react-native";

export const colors = {
  background: "#F3F7FC",
  surface: "#E7F0FB",
  surfaceMuted: "#D8E8FA",
  card: "#FFFFFF",
  cardSoft: "#F7FBFF",
  textPrimary: "#18324A",
  textOnDark: "#FFFFFF",
  textMuted: "#5E7894",
  accent: "#2F80ED",
  accentStrong: "#1D66C2",
  success: "#1FA971",
  warning: "#EE9B32",
  danger: "#D95A5A",
  border: "#C9DAEE"
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28
};

export const fontFamily = {
  regular: Platform.select({ ios: "Avenir Next", android: "sans-serif", default: "System" }),
  medium: Platform.select({ ios: "Avenir Next Demi Bold", android: "sans-serif-medium", default: "System" }),
  bold: Platform.select({ ios: "Avenir Next Bold", android: "sans-serif-medium", default: "System" })
};
