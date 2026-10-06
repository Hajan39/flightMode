import { useColorScheme as useColorSchemeCore } from "react-native";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useSupporterStore } from "@/store/useSupporterStore";

export type ResolvedScheme = "light" | "dark" | "crazy" | "midnight" | "sunset";

/** Plus themes need the FlightMode Plus entitlement. */
export const PLUS_THEMES: ReadonlySet<string> = new Set(["midnight", "sunset"]);

/** The free scheme a Plus theme derives from (for per-scheme color overrides). */
export function baseScheme(scheme: ResolvedScheme): "light" | "dark" | "crazy" {
  return PLUS_THEMES.has(scheme)
    ? "dark"
    : (scheme as "light" | "dark" | "crazy");
}

export const useColorScheme = (): ResolvedScheme => {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const plus = useSupporterStore((s) => s.plus);
  const coreScheme = useColorSchemeCore();
  const systemScheme: ResolvedScheme = coreScheme === "dark" ? "dark" : "light";

  if (
    !themeMode ||
    themeMode === "system" ||
    (PLUS_THEMES.has(themeMode) && !plus)
  ) {
    return systemScheme;
  }
  return themeMode as ResolvedScheme;
};
