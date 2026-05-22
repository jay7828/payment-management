import { useWindowDimensions } from "react-native";
import { DESKTOP_BREAKPOINT } from "../theme";

export function useBreakpoint() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  return { isDesktop, width };
}
