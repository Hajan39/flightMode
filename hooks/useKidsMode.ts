import { useSettingsStore } from "@/store/useSettingsStore";

/** Whether kids mode is on (live). Non-React code: `isKidsModeOn()`. */
export function useKidsMode(): boolean {
  return useSettingsStore((s) => s.kidsMode);
}
