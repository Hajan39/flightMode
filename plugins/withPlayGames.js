const {
	withAndroidManifest,
	withStringsXml,
	withAppBuildGradle,
	AndroidConfig,
} = require("@expo/config-plugins");

/**
 * Expo config plugin: links the Google Play Games Services (PGS) SDK into the
 * Android build so the API can be used, matching Google's documented setup
 * (the `res/values/games-ids.xml` + manifest meta-data + gradle dependency).
 *
 * Google Play Console gates PGS on the SDK being present in an APK/AAB published
 * to a testing/production track ("Add the Play Games Services SDK to your APK…").
 * This plugin makes that true for the production build.
 *
 * It does three things when `expo.extra.playGamesAppId` is set:
 *   1. Adds `<string name="app_id">…</string>` to strings.xml (Google's
 *      games-ids.xml value, folded into the app's existing strings resource).
 *   2. Adds `<meta-data android:name="com.google.android.gms.games.APP_ID"
 *      android:value="@string/app_id" />` to the <application>.
 *   3. Adds `implementation 'com.google.android.gms:play-services-games-v2:<ver>'`
 *      to app/build.gradle — this is what actually bundles the SDK into the AAB.
 *
 * USAGE (app.json):
 *   "plugins": [ ..., "./plugins/withPlayGames" ],
 *   "extra": { "playGamesAppId": "944569415010" }
 *
 * SAFETY: if `playGamesAppId` is missing/empty every step is a no-op and the
 * config is returned unchanged, so the plugin can be committed before an id is
 * known without affecting `expo prebuild` / the EAS build. All three steps are
 * idempotent, so re-running prebuild won't duplicate entries.
 */

// Latest stable Play Games Services v2 SDK (June 2025). Bump as needed.
const PLAY_GAMES_V2_VERSION = "21.0.0";
const APP_ID_STRING_NAME = "app_id";
const GAMES_APP_ID_META = "com.google.android.gms.games.APP_ID";

function getAppId(config) {
	const appId = config.extra?.playGamesAppId;
	return appId ? String(appId).trim() : null;
}

const withGamesStringResource = (config, appId) =>
	withStringsXml(config, (cfg) => {
		cfg.modResults = AndroidConfig.Strings.setStringItem(
			[
				{
					_: appId,
					$: { name: APP_ID_STRING_NAME, translatable: "false" },
				},
			],
			cfg.modResults,
		);
		return cfg;
	});

const withGamesManifestMetadata = (config) =>
	withAndroidManifest(config, (cfg) => {
		const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
			cfg.modResults,
		);
		AndroidConfig.Manifest.addMetaDataItemToMainApplication(
			application,
			GAMES_APP_ID_META,
			`@string/${APP_ID_STRING_NAME}`,
		);
		return cfg;
	});

const withGamesGradleDependency = (config) =>
	withAppBuildGradle(config, (cfg) => {
		if (cfg.modResults.language !== "groovy") {
			throw new Error(
				"withPlayGames: expected a Groovy build.gradle; cannot add the Play Games dependency.",
			);
		}
		const contents = cfg.modResults.contents;
		if (contents.includes("play-services-games-v2")) {
			return cfg; // already present — keep idempotent
		}
		const dependency = `    implementation 'com.google.android.gms:play-services-games-v2:${PLAY_GAMES_V2_VERSION}'`;
		// Insert as the first line inside the app-level `dependencies { … }` block.
		cfg.modResults.contents = contents.replace(
			/dependencies\s*\{/,
			(match) => `${match}\n${dependency}`,
		);
		return cfg;
	});

const withPlayGames = (config) => {
	const appId = getAppId(config);
	if (!appId) {
		// No id configured yet — full no-op so prebuild/EAS stays green.
		return config;
	}
	let cfg = withGamesStringResource(config, appId);
	cfg = withGamesManifestMetadata(cfg);
	cfg = withGamesGradleDependency(cfg);
	return cfg;
};

module.exports = withPlayGames;
