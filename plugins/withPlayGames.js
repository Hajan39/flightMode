const {
	withAndroidManifest,
	AndroidConfig,
} = require("@expo/config-plugins");

/**
 * Expo config plugin: wires the Google Play Games Services (PGS) app id into the
 * Android manifest.
 *
 * Play Games requires a `<meta-data android:name="com.google.android.gms.games.APP_ID">`
 * entry inside <application>, whose value is the numeric **project id** from
 * Play Console → Play Games Services → Configuration (looks like `1234567890`).
 *
 * USAGE
 * ─────
 * In app.json, add this plugin and supply the id via `expo.extra.playGamesAppId`:
 *
 *   "plugins": [ ..., "./plugins/withPlayGames" ],
 *   "extra": { "playGamesAppId": "1234567890" }
 *
 * SAFETY
 * ──────
 * If `playGamesAppId` is missing/empty the plugin is a no-op and returns the
 * config unchanged — so committing the plugin reference before the id is known
 * cannot break `expo prebuild` / the EAS build. The manifest metadata alone does
 * nothing at runtime without a linked native PGS module; both are required for
 * PGS to actually function (see `utils/playGames.ts`).
 *
 * Note: Play Games also needs an `@string/game_ids_...`-style value in some
 * setups. Using the raw numeric id as the meta-data value is the documented
 * modern approach and avoids an extra strings.xml resource.
 */
const withPlayGames = (config) => {
	return withAndroidManifest(config, (cfg) => {
		const appId = cfg.extra?.playGamesAppId;
		if (!appId) {
			// No id configured yet — do nothing so prebuild stays green.
			return cfg;
		}

		const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
			cfg.modResults,
		);

		AndroidConfig.Manifest.addMetaDataItemToMainApplication(
			application,
			"com.google.android.gms.games.APP_ID",
			// Prefix with a backslash so AAPT treats it as a literal string, not
			// an integer resource id (a classic Play Games manifest gotcha).
			`\\ ${appId}`.trim(),
		);

		return cfg;
	});
};

module.exports = withPlayGames;
