#!/usr/bin/env node
/**
 * Builds the Play Console "Import achievements" CSVs from data/achievements.ts
 * and the i18n locales, so the 48 achievements never have to be typed by hand.
 *
 *   node scripts/export-pgs-achievements.js [outDir]   (default: build/pgs-achievements)
 *
 * Then zip the folder's files (no subdirectory) and upload in Play Console →
 * Play Games Services → Achievements → Import achievements. After import, copy
 * each generated CgkI… id into data/playGamesAchievements.ts.
 *
 * Format: https://support.google.com/googleplay/android-developer/answer/2990418
 * (no header row, no commas inside fields, points multiple of 5, ≤1000 total).
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const outDir = path.resolve(process.argv[2] ?? path.join(root, "build", "pgs-achievements"));

// Play Games locale for each app language; en is the default (no localization row).
const LOCALES = {
	cs: "cs-CZ", de: "de-DE", es: "es-ES", fr: "fr-FR", hi: "hi-IN", it: "it-IT",
	ja: "ja-JP", ko: "ko-KR", pl: "pl-PL", pt: "pt-PT", zh: "zh-CN",
};
// ponytail: flat 20 points each (48 × 20 = 960 ≤ 1000 cap); rebalance in Play Console if wanted.
const POINTS = 20;

function loadLocale(lang) {
	const src = fs.readFileSync(path.join(root, "i18n", "locales", `${lang}.ts`), "utf8");
	const sandbox = { module: {} };
	const js = src
		.replace(/export const \w+\s*(:[^=]+)?=/, "module.exports =")
		.replace(/\}\s*as const;?\s*$/, "};");
	vm.runInNewContext(js, sandbox);
	return sandbox.module.exports;
}

const achievementsSrc = fs.readFileSync(path.join(root, "data", "achievements.ts"), "utf8");
const achievements = [
	...achievementsSrc.matchAll(/id: "([^"]+)",\s*titleKey: "([^"]+)",\s*descriptionKey: "([^"]+)"/g),
].map(([, id, titleKey, descriptionKey]) => ({ id, titleKey, descriptionKey }));

// Commas are field separators with no quoting support — swap them out.
const clean = (text) => String(text).replace(/\s*,\s*/g, " · ").replace(/[\r\n]+/g, " ").trim();

const en = loadLocale("en");
const missing = achievements.filter((a) => !en[a.titleKey] || !en[a.descriptionKey]);
if (missing.length) throw new Error(`Missing en strings: ${missing.map((a) => a.id).join(", ")}`);
const names = achievements.map((a) => clean(en[a.titleKey]));
const dupes = names.filter((n, i) => names.indexOf(n) !== i);
if (dupes.length) throw new Error(`Achievement names must be unique: ${dupes.join(", ")}`);

const metadata = achievements.map(
	(a, i) => `${names[i]},${clean(en[a.descriptionKey])},False,,Revealed,${POINTS},${i + 1}`,
);
const localizations = [];
for (const [lang, locale] of Object.entries(LOCALES)) {
	const t = loadLocale(lang);
	achievements.forEach((a, i) => {
		if (t[a.titleKey]) {
			localizations.push(`${names[i]},${clean(t[a.titleKey])},${clean(t[a.descriptionKey] ?? "")},${locale}`);
		}
	});
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "AchievementsMetadata.csv"), metadata.join("\n") + "\n");
fs.writeFileSync(path.join(outDir, "AchievementsLocalizations.csv"), localizations.join("\n") + "\n");
fs.writeFileSync(
	`${outDir}-ids.txt`, // outside the folder: the zip may only hold CSV/images
	achievements.map((a, i) => `${a.id}\t${names[i]}`).join("\n") + "\n",
);
console.log(`${achievements.length} achievements, ${localizations.length} localizations → ${outDir}`);
