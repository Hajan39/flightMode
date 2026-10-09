#!/usr/bin/env node
/**
 * Builds the Play Console "Import achievements" CSVs from data/achievements.ts
 * and the i18n locales, so the achievements never have to be typed by hand.
 *
 *   node scripts/export-pgs-achievements.mjs [outDir]   (default: build/pgs-achievements)
 *
 * Then zip the folder's files (no subdirectory) and upload in Play Console →
 * Play Games Services → Achievements → Import achievements. After import, copy
 * each generated CgkI… id into data/playGamesAchievements.ts.
 *
 * Format: https://support.google.com/googleplay/android-developer/answer/2990418
 * (no header row, no commas inside fields, points multiple of 5, ≤1000 total).
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.join(import.meta.dirname, "..");
const outDir = path.resolve(
  process.argv[2] ?? path.join(root, "build", "pgs-achievements")
);

const LOCALE_EXPORT_RE = /export const \w+\s*(:[^=]+)?=/;
const LOCALE_AS_CONST_RE = /\}\s*as const;?\s*$/;
const ACHIEVEMENTS_ARRAY_START = "export const achievements";
const ENTRY_START = /\n {2}\{\n/;
const ID_RE = /\n\s+id: "([^"]+)"/;
const TITLE_KEY_RE = /\n\s+titleKey: "([^"]+)"/;
const DESCRIPTION_KEY_RE = /\n\s+descriptionKey: "([^"]+)"/;
const ID_COUNT_RE = /\n {4}id: "[^"]+"/g;

// Play Games locale for each app language; en is the default (no localization row).
const LOCALES = {
  cs: "cs-CZ",
  de: "de-DE",
  es: "es-ES",
  fr: "fr-FR",
  hi: "hi-IN",
  it: "it-IT",
  ja: "ja-JP",
  ko: "ko-KR",
  pl: "pl-PL",
  pt: "pt-PT",
  zh: "zh-CN",
};
// Flat 20 points each; the 1000-point Play cap allows up to 50 achievements
// (asserted below). Rebalance in Play Console if wanted.
const POINTS = 20;

function loadLocale(lang) {
  const src = fs.readFileSync(
    path.join(root, "i18n", "locales", `${lang}.ts`),
    "utf8"
  );
  const sandbox = { module: {} };
  const js = src
    .replace(LOCALE_EXPORT_RE, "module.exports =")
    .replace(LOCALE_AS_CONST_RE, "};");
  vm.runInNewContext(js, sandbox);
  return sandbox.module.exports;
}

const achievementsSrc = fs.readFileSync(
  path.join(root, "data", "achievements.ts"),
  "utf8"
);
// Each achievement is a top-level `{ … }` entry; read its keys independently
// so the parse doesn't depend on key order (the formatter sorts keys).
const achievements = achievementsSrc
  .slice(achievementsSrc.indexOf(ACHIEVEMENTS_ARRAY_START))
  .split(ENTRY_START)
  .map((chunk) => ({
    descriptionKey: chunk.match(DESCRIPTION_KEY_RE)?.[1],
    id: chunk.match(ID_RE)?.[1],
    titleKey: chunk.match(TITLE_KEY_RE)?.[1],
  }))
  .filter((a) => a.id && a.titleKey && a.descriptionKey);

// Commas are field separators with no quoting support — swap them out.
const clean = (text) =>
  String(text)
    .replace(/\s*,\s*/g, " · ")
    .replace(/[\r\n]+/g, " ")
    .trim();

// Guard against a silent empty export (the old order-dependent regex once
// produced 0 rows without any error).
const declaredIds = achievementsSrc.match(ID_COUNT_RE) ?? [];
if (achievements.length === 0 || achievements.length !== declaredIds.length) {
  throw new Error(
    `Parsed ${achievements.length} achievements but data/achievements.ts declares ${declaredIds.length}`
  );
}
if (achievements.length * POINTS > 1000) {
  throw new Error(
    `${achievements.length} × ${POINTS} points exceeds Play's 1000-point cap`
  );
}

const en = loadLocale("en");
const missing = achievements.filter(
  (a) => !(en[a.titleKey] && en[a.descriptionKey])
);
if (missing.length) {
  throw new Error(`Missing en strings: ${missing.map((a) => a.id).join(", ")}`);
}
const names = achievements.map((a) => clean(en[a.titleKey]));
const dupes = names.filter((n, i) => names.indexOf(n) !== i);
if (dupes.length) {
  throw new Error(`Achievement names must be unique: ${dupes.join(", ")}`);
}

// Play rejects the import if two achievements share a name within any locale,
// so check every exported language, not just English.
for (const lang of Object.keys(LOCALES)) {
  const dict = loadLocale(lang);
  const localized = achievements.map((a) => clean(dict[a.titleKey] ?? ""));
  const localeDupes = localized.filter(
    (n, i) => n && localized.indexOf(n) !== i
  );
  if (localeDupes.length) {
    throw new Error(
      `Duplicate ${LOCALES[lang]} achievement names: ${[...new Set(localeDupes)].join(", ")}`
    );
  }
}

const metadata = achievements.map(
  (a, i) =>
    `${names[i]},${clean(en[a.descriptionKey])},False,,Revealed,${POINTS},${i + 1}`
);
const localizations = [];
for (const [lang, locale] of Object.entries(LOCALES)) {
  const t = loadLocale(lang);
  achievements.forEach((a, i) => {
    if (t[a.titleKey]) {
      localizations.push(
        `${names[i]},${clean(t[a.titleKey])},${clean(t[a.descriptionKey] ?? "")},${locale}`
      );
    }
  });
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "AchievementsMetadata.csv"),
  `${metadata.join("\n")}\n`
);
fs.writeFileSync(
  path.join(outDir, "AchievementsLocalizations.csv"),
  `${localizations.join("\n")}\n`
);
fs.writeFileSync(
  `${outDir}-ids.txt`, // outside the folder: the zip may only hold CSV/images
  `${achievements.map((a, i) => `${a.id}\t${names[i]}`).join("\n")}\n`
);
console.log(
  `${achievements.length} achievements, ${localizations.length} localizations → ${outDir}`
);
