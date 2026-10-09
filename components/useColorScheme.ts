import { useColorScheme as useColorSchemeCore } from "react-native";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useSupporterStore } from "@/store/useSupporterStore";

import { PLUS_THEMES, type ResolvedScheme } from "./colorSchemes";

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
