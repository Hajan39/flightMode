import { useEffect } from "react";

import { initPlayGames } from "@/utils/playGames";

/**
 * Kicks off a one-time silent Google Play Games sign-in on launch so the first
 * achievement push isn't delayed by an on-demand sign-in.
 *
 * `initPlayGames()` is a guarded no-op when no native PGS module is linked
 * (Expo Go, iOS, web, current release build), so mounting this is always safe.
 */
export default function PlayGamesBootstrap() {
	useEffect(() => {
		void initPlayGames();
	}, []);

	return null;
}
