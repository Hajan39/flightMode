import { useMemo } from "react";

import { PlayerColors } from "@/constants/Colors";
import { useTranslation } from "@/hooks/useTranslation";
import { usePlayersStore } from "@/store/usePlayersStore";

export type MatchPlayer = {
	/** Seat index, 0-based. Seat 0 is the host (device owner). */
	index: number;
	/** Display name — the stored seat name or the localized "Player N". */
	name: string;
	color: string;
	isHost: boolean;
};

/**
 * Resolves `count` seats into display-ready players (name + color). Every
 * multiplayer component takes `MatchPlayer` so no game re-derives colors/names.
 */
export function useMatchPlayers(count: number): MatchPlayer[] {
	const seats = usePlayersStore((s) => s.seats);
	const { t, language } = useTranslation();

	return useMemo(
		() =>
			Array.from({ length: count }, (_, index) => {
				const stored = seats[index]?.name.trim() ?? "";
				return {
					index,
					name: stored.length > 0 ? stored : t("mpPlayerN", { n: index + 1 }),
					color: PlayerColors[index % PlayerColors.length],
					isHost: index === 0,
				};
			}),
		// `language` is read so names re-localize when the UI language changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[count, seats, language],
	);
}
