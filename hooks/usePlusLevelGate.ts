import { useRouter } from "expo-router";
import { useSupporterStore } from "@/store/useSupporterStore";
import { type GatedLevel, levelTapAction } from "@/utils/plusLevels";

/**
 * Level-picker gate for FlightMode Plus packs. `openLevel(level, start)` runs
 * `start` for free levels (always) and for Plus levels when the player has
 * Plus; a locked Plus level opens the Plus screen instead of starting.
 */
export function usePlusLevelGate() {
  const hasPlus = useSupporterStore((state) => state.plus);
  const router = useRouter();

  const openLevel = (level: GatedLevel, start: () => void) => {
    if (levelTapAction(level, hasPlus) === "play") {
      start();
      return;
    }
    router.push("/plus" as never);
  };

  return { hasPlus, openLevel };
}
