#!/usr/bin/env node
import { spawnSync } from "node:child_process";
/**
 * Builds the world-quiz data from the question-pool working folder.
 *
 *   node scripts/build-quiz-data.mjs <quizDir>
 *
 * <quizDir> layout (produced by the question-pool pipeline, see its SPEC.md):
 *   checked/<SET>-batch-NN.json   English pool + `check` (rejected ones skipped)
 *   bundled/ids.json              the 100 bundled ids (ordered)
 *   bundled/<lang>.json           bundled translations (en es fr it pl pt hi ja ko zh)
 *   i18n/<lang>/*.json            full-pool translations (cs, de)
 *
 * Outputs (deterministic — re-running on unchanged inputs changes nothing):
 *   data/worldQuiz/<lang>.json      100 bundled questions for all 12 app languages
 *   content/quiz/<lang>/index.json  remote pack index (en, cs, de)
 *   content/quiz/<lang>/pack-NNN.json  ≤ 250 extra questions each (no bundled ids)
 *   content/quiz/sources.json       id → reference URL (provenance; not shipped)
 *
 * A language without a complete bundled translation falls back to English for
 * the bundled file (WARNING); a pool translation missing more than 2 % of the
 * remote questions gets no packs (WARNING) — re-run once it exists. A few ids
 * missing on purpose (de drops some giveaway questions) are skipped for that
 * language only. `__tests__/worldQuizData.test.ts` fails while a bundled
 * file is an English fallback for a language whose inputs exist.
 *
 * The app does not need `source` / `tags` (never shown); they are dropped from
 * app data and packs to keep bundle and download small. Sources are kept in
 * content/quiz/sources.json so every answer stays traceable.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const quizDir = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!(quizDir && fs.existsSync(quizDir))) {
  console.error("Usage: node scripts/build-quiz-data.mjs <quizDir>");
  process.exit(1);
}

const APP_LANGUAGES = [
  "cs",
  "de",
  "en",
  "es",
  "fr",
  "hi",
  "it",
  "ja",
  "ko",
  "pl",
  "pt",
  "zh",
];
/**
 * Languages whose full pool is translated: every app language with an
 * `i18n/<lang>/` folder in the quiz workspace. They get remote packs, and
 * their bundled set is taken from that translation.
 */
const POOL_TRANSLATED = new Set(
  quizDir && fs.existsSync(path.join(quizDir, "i18n"))
    ? fs
        .readdirSync(path.join(quizDir, "i18n"))
        .filter((lang) => APP_LANGUAGES.includes(lang) && lang !== "en")
    : []
);
/** Languages with a translated full pool → remote packs. */
const REMOTE_LANGUAGES = ["en", ...[...POOL_TRANSLATED].sort()];
const PACK_SIZE = 250;
const BUNDLED_COUNT = 100;
/** Up to this share of the remote pool may be missing in a translation. */
const MAX_MISSING_SHARE = 0.02;
// Keep in sync with QUIZ_LIMITS in utils/quizSync.ts.
const LIMITS = { category: 40, explanation: 300, option: 60, question: 200 };
const BATCH_FILE = /^[A-Z]+-batch-(\d+)\.json$/;
const ID_RE = /^[a-z0-9-]{1,32}$/;

const warnings = [];
const warn = (msg) => {
  warnings.push(msg);
  console.warn(`WARNING: ${msg}`);
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Batch files in pipeline order: set letter, then batch number. */
function batchFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((f) => BATCH_FILE.test(f))
    .sort((a, b) => {
      const [sa, sb] = [a.split("-")[0], b.split("-")[0]];
      if (sa !== sb) {
        return sa < sb ? -1 : 1;
      }
      return Number(BATCH_FILE.exec(a)[1]) - Number(BATCH_FILE.exec(b)[1]);
    })
    .map((f) => path.join(dir, f));
}

/** The app shape, keys sorted (Biome `useSortedKeys`). Null when invalid. */
function toAppQuestion(q) {
  const ok =
    q &&
    typeof q.id === "string" &&
    ID_RE.test(q.id) &&
    typeof q.category === "string" &&
    q.category.length > 0 &&
    q.category.length <= LIMITS.category &&
    [1, 2, 3].includes(q.difficulty) &&
    typeof q.question === "string" &&
    q.question.trim().length > 0 &&
    q.question.length <= LIMITS.question &&
    Array.isArray(q.options) &&
    q.options.length === 4 &&
    q.options.every(
      (o) =>
        typeof o === "string" &&
        o.trim().length > 0 &&
        o.length <= LIMITS.option
    ) &&
    new Set(q.options.map((o) => o.trim())).size === 4 &&
    Number.isInteger(q.answer) &&
    q.answer >= 0 &&
    q.answer <= 3 &&
    typeof q.explanation === "string" &&
    q.explanation.length <= LIMITS.explanation;
  if (!ok) {
    return null;
  }
  return {
    answer: q.answer,
    category: q.category,
    difficulty: q.difficulty,
    explanation: q.explanation.trim(),
    id: q.id,
    options: q.options.map((o) => o.trim()),
    question: q.question.trim(),
  };
}

/** A translation must keep id, answer index, category and difficulty. */
function matchesEnglish(tr, en) {
  return (
    tr.answer === en.answer &&
    tr.category === en.category &&
    tr.difficulty === en.difficulty
  );
}

// ---------------------------------------------------------------- English pool
const pool = [];
const poolById = new Map();
const sources = {};
for (const file of batchFiles(path.join(quizDir, "checked"))) {
  for (const raw of readJson(file)) {
    if (raw.check?.status === "rejected") {
      continue;
    }
    const q = toAppQuestion(raw);
    if (!q) {
      warn(`invalid English question ${raw?.id} in ${path.basename(file)}`);
      continue;
    }
    if (poolById.has(q.id)) {
      throw new Error(`duplicate id ${q.id} in the English pool`);
    }
    pool.push(q);
    poolById.set(q.id, q);
    if (typeof raw.source === "string") {
      sources[q.id] = raw.source;
    }
  }
}
if (pool.length === 0) {
  throw new Error(`no questions found in ${path.join(quizDir, "checked")}`);
}

const bundledIds = readJson(path.join(quizDir, "bundled", "ids.json"));
if (
  bundledIds.length !== BUNDLED_COUNT ||
  new Set(bundledIds).size !== BUNDLED_COUNT
) {
  throw new Error(`bundled/ids.json must list ${BUNDLED_COUNT} unique ids`);
}
const bundledSet = new Set(bundledIds);
for (const id of bundledIds) {
  if (!poolById.has(id)) {
    throw new Error(`bundled id ${id} is not in the (non-rejected) pool`);
  }
}

// ----------------------------------------------------------- translations
/** id → app question for one language (pool translations or bundled file). */
function loadTranslations(lang) {
  const map = new Map();
  const add = (raw, where) => {
    // Reviewers mark questions that don't work in one language (e.g. the
    // answer hides in the translated wording) as `<lang>_drop`.
    if (raw?.[`${lang}_drop`] === true) {
      return;
    }
    const q = toAppQuestion(raw);
    const en = q && poolById.get(q.id);
    if (!(q && en)) {
      warn(`${lang}: invalid or unknown question ${raw?.id} (${where})`);
      return;
    }
    if (!matchesEnglish(q, en)) {
      warn(
        `${lang}: ${q.id} differs from English in answer/category/difficulty`
      );
      return;
    }
    map.set(q.id, q);
  };
  if (POOL_TRANSLATED.has(lang)) {
    // The bundled translation is the baseline, so a pool translation still in
    // progress never pushes English into the app; the pool overrides it.
    const bundledFile = path.join(quizDir, "bundled", `${lang}.json`);
    if (fs.existsSync(bundledFile)) {
      for (const raw of readJson(bundledFile)) {
        add(raw, `bundled/${lang}.json`);
      }
    }
    for (const file of batchFiles(path.join(quizDir, "i18n", lang))) {
      let items;
      try {
        items = readJson(file);
      } catch (error) {
        warn(`${lang}: unreadable ${path.basename(file)} (${error.message})`);
        continue;
      }
      for (const raw of items) {
        add(raw, path.basename(file));
      }
    }
  } else if (lang === "en") {
    for (const q of pool) {
      map.set(q.id, q);
    }
  } else {
    const file = path.join(quizDir, "bundled", `${lang}.json`);
    if (fs.existsSync(file)) {
      for (const raw of readJson(file)) {
        add(raw, `bundled/${lang}.json`);
      }
    }
  }
  return map;
}

const translations = Object.fromEntries(
  APP_LANGUAGES.map((lang) => [lang, loadTranslations(lang)])
);

// ------------------------------------------------------------- output helpers
let written = [];
function writeJson(rel, value) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const text = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(file, text);
  written.push(file);
  return Buffer.byteLength(text);
}
const sha256 = (text) => createHash("sha256").update(text).digest("hex");

// ------------------------------------------------------------- bundled files
const bundledSummary = {};
for (const lang of APP_LANGUAGES) {
  const map = translations[lang];
  const missing = bundledIds.filter((id) => !map.has(id));
  let fallback = false;
  if (missing.length > 0) {
    fallback = true;
    warn(
      `${lang}: ${missing.length}/${BUNDLED_COUNT} bundled questions not translated — data/worldQuiz/${lang}.json falls back to ENGLISH. Re-run when the translation is complete.`
    );
  }
  const questions = bundledIds.map((id) =>
    fallback ? poolById.get(id) : map.get(id)
  );
  writeJson(`data/worldQuiz/${lang}.json`, {
    // Data-quality marker read by the integrity test (not used by the app).
    fallback,
    lang,
    questions,
  });
  bundledSummary[lang] = { fallback };
}

// ---------------------------------------------------------------- remote packs
const remoteIds = pool.map((q) => q.id).filter((id) => !bundledSet.has(id));
const packSummary = {};
for (const lang of REMOTE_LANGUAGES) {
  const map = translations[lang];
  const missing = remoteIds.filter((id) => !map.has(id));
  // A few ids may be left out on purpose (e.g. questions that give the
  // answer away in that language): skip them for this language. A largely
  // untranslated pool is still being produced — no packs then.
  if (missing.length > remoteIds.length * MAX_MISSING_SHARE) {
    warn(
      `${lang}: ${missing.length}/${remoteIds.length} pool questions not translated — content/quiz/${lang}/ NOT generated. Re-run when the translation is complete.`
    );
    continue;
  }
  if (missing.length > 0) {
    warn(
      `${lang}: ${missing.length} pool question(s) not in this language, skipped: ${missing.join(", ")}`
    );
  }
  const dir = path.join(root, "content", "quiz", lang);
  // Remove stale packs from an earlier, bigger pool.
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      if (/^pack-\d+\.json$/.test(f)) {
        fs.rmSync(path.join(dir, f));
      }
    }
  }
  const packs = [];
  for (let i = 0; i * PACK_SIZE < remoteIds.length; i += 1) {
    const id = `pack-${String(i + 1).padStart(3, "0")}`;
    // Same id → pack assignment as English (packs stay aligned across
    // languages); skipped ids just make that language's pack smaller.
    const questions = remoteIds
      .slice(i * PACK_SIZE, (i + 1) * PACK_SIZE)
      .filter((qid) => map.has(qid))
      .map((qid) => map.get(qid));
    const file = `${id}.json`;
    writeJson(`content/quiz/${lang}/${file}`, { id, lang, questions });
    packs.push({ count: questions.length, file, id });
  }
  packSummary[lang] = packs;
}

// Format with the repo's Biome config so `biome ci` stays clean, then hash
// the final bytes (the app compares `sha256` to decide what to re-download).
const biome = path.join(root, "node_modules", ".bin", "biome");
function formatWritten() {
  if (!fs.existsSync(biome)) {
    warn("Biome not found — outputs are not formatted (run npm install)");
  } else if (written.length > 0) {
    const res = spawnSync(biome, ["format", "--write", ...written], {
      cwd: root,
      encoding: "utf8",
    });
    if (res.status !== 0) {
      warn(`biome format failed:\n${res.stderr || res.stdout}`);
    }
  }
  written = [];
}
formatWritten();
const fileBytes = (rel) => fs.statSync(path.join(root, rel)).size;

for (const [lang, packs] of Object.entries(packSummary)) {
  const entries = packs.map((p) => {
    const text = fs.readFileSync(
      path.join(root, "content", "quiz", lang, p.file),
      "utf8"
    );
    return {
      bytes: Buffer.byteLength(text),
      count: p.count,
      file: p.file,
      id: p.id,
      sha256: sha256(text),
    };
  });
  // Content-derived version: changes exactly when a pack changes, so a
  // re-run on unchanged inputs leaves the index untouched.
  const version = sha256(entries.map((e) => e.sha256).join(":")).slice(0, 12);
  writeJson(`content/quiz/${lang}/index.json`, {
    lang,
    packs: entries,
    version,
  });
  packSummary[lang] = entries;
}
writeJson(
  "content/quiz/sources.json",
  Object.fromEntries(
    Object.entries(sources).sort(([a], [b]) => (a < b ? -1 : 1))
  )
);
formatWritten();

// -------------------------------------------------------------------- report
console.log(
  `English pool: ${pool.length} questions (${BUNDLED_COUNT} bundled, ${remoteIds.length} remote)`
);
for (const [lang, s] of Object.entries(bundledSummary)) {
  console.log(
    `  data/worldQuiz/${lang}.json  ${fileBytes(`data/worldQuiz/${lang}.json`)} B${s.fallback ? "  (ENGLISH FALLBACK)" : ""}`
  );
}
for (const [lang, entries] of Object.entries(packSummary)) {
  const total = entries.reduce((n, e) => n + e.bytes, 0);
  console.log(
    `  content/quiz/${lang}/  ${entries.length} packs, ${entries.reduce((n, e) => n + e.count, 0)} questions, ${total} B`
  );
}
if (warnings.length > 0) {
  console.warn(`\n${warnings.length} WARNING(S) — see above.`);
}
