import { useColorScheme as useColorSchemeCore } from "react-native";
import { useSettingsStore } from "@/store/useSettingsStore";

export type ResolvedScheme = "light" | "dark" | "crazy";

export const useColorScheme = (): ResolvedScheme => {
	const themeMode = useSettingsStore((s) => s.themeMode);
	const coreScheme = useColorSchemeCore();
	const systemScheme = coreScheme === "unspecified" ? "light" : coreScheme;

	if (themeMode === "system") {
		return systemScheme;
	}
	return themeMode;
};
