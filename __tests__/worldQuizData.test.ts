/**
 * Integrity of the generated world-quiz data (scripts/build-quiz-data.mjs):
 * bundled files for all 12 app languages and the remote packs.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  getBundledWorldQuizFile,
  type WorldQuestion,
  worldQuizLanguages,
} from "@/data/worldQuiz";
import {
  isWorldQuestion,
  parseQuizIndex,
  parseQuizPack,
  QUIZ_REMOTE_LANGUAGES,
} from "@/utils/quizSync";

// Jest runs from the repo root (rootDir).
const ROOT = process.cwd();
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
const PACK_SIZE = 250;

const en = getBundledWorldQuizFile("en").questions;
const enIds = en.map((q) => q.id);
const bundledIds = new Set(enIds);

const readJson = (rel: string) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));

describe("bundled world quiz", () => {
  test("covers exactly the 12 app languages", () => {
    expect([...worldQuizLanguages].sort()).toEqual(APP_LANGUAGES);
    for (const lang of APP_LANGUAGES) {
      expect(
        fs.existsSync(path.join(ROOT, `data/worldQuiz/${lang}.json`))
      ).toBe(true);
    }
  });

  test("100 unique, valid English questions", () => {
    expect(en).toHaveLength(100);
    expect(new Set(enIds).size).toBe(100);
    expect(en.every(isWorldQuestion)).toBe(true);
  });

  describe.each(APP_LANGUAGES)("%s", (lang) => {
    const file = getBundledWorldQuizFile(lang as never);

    test("is a real translation (no English fallback)", () => {
      // The build script marks a missing translation; re-run it with the
      // translation inputs to fix (see CLAUDE.md, Quiz pool).
      expect(file.fallback).toBe(false);
      expect(file.lang).toBe(lang);
    });

    test("same ids, answers, categories and difficulties as English", () => {
      const strip = (q: WorldQuestion) => [
        q.id,
        q.answer,
        q.category,
        q.difficulty,
      ];
      expect(file.questions.map(strip)).toEqual(en.map(strip));
    });

    test("every question passes the app validator", () => {
      const invalid = file.questions
        .filter((q) => !isWorldQuestion(q))
        .map((q) => q.id);
      expect(invalid).toEqual([]);
    });

    if (lang !== "en") {
      test("text is actually translated", () => {
        const same = file.questions.filter(
          (q, i) => q.question === en[i].question
        );
        expect(same.length).toBeLessThan(10);
      });
    }
  });
});

describe("remote quiz packs", () => {
  const packIds: Record<string, string[]> = {};

  describe.each([...QUIZ_REMOTE_LANGUAGES])("%s", (lang) => {
    const rawIndex = readJson(`content/quiz/${lang}/index.json`);
    const index = parseQuizIndex(rawIndex, lang);

    test("index is valid and lists every pack file", () => {
      expect(index.packs.length).toBe(rawIndex.packs.length);
      expect(index.packs.length).toBeGreaterThan(0);
      const files = fs
        .readdirSync(path.join(ROOT, `content/quiz/${lang}`))
        .filter((f) => f.startsWith("pack-"))
        .sort();
      expect(index.packs.map((p) => p.file).sort()).toEqual(files);
    });

    test("sha256, bytes and count match each pack file", () => {
      for (const [i, entry] of index.packs.entries()) {
        const text = fs.readFileSync(
          path.join(ROOT, `content/quiz/${lang}/${entry.file}`),
          "utf8"
        );
        expect(createHash("sha256").update(text).digest("hex")).toBe(
          entry.sha256
        );
        expect(Buffer.byteLength(text)).toBe(rawIndex.packs[i].bytes);
        const questions = parseQuizPack(JSON.parse(text));
        // Nothing dropped by the app validator.
        expect(questions).toHaveLength(JSON.parse(text).questions.length);
        expect(questions).toHaveLength(entry.count);
        expect(entry.count).toBeLessThanOrEqual(PACK_SIZE);
      }
    });

    test("ids unique and disjoint from the bundled set", () => {
      const ids = index.packs.flatMap(
        (entry) =>
          readJson(`content/quiz/${lang}/${entry.file}`).questions.map(
            (q: WorldQuestion) => q.id
          ) as string[]
      );
      packIds[lang] = ids;
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.filter((id) => bundledIds.has(id))).toEqual([]);
    });
  });

  test("translated packs are subsets of English, pack by pack", () => {
    const enIndex = parseQuizIndex(
      readJson("content/quiz/en/index.json"),
      "en"
    );
    const idsOf = (lang: string, file: string) =>
      new Set<string>(
        readJson(`content/quiz/${lang}/${file}`).questions.map(
          (q: WorldQuestion) => q.id
        )
      );
    for (const lang of ["cs", "de"]) {
      const index = parseQuizIndex(
        readJson(`content/quiz/${lang}/index.json`),
        lang
      );
      expect(index.packs.map((p) => p.id)).toEqual(
        enIndex.packs.map((p) => p.id)
      );
      for (const entry of index.packs) {
        const enSet = idsOf("en", entry.file);
        for (const id of idsOf(lang, entry.file)) {
          expect(enSet.has(id)).toBe(true);
        }
      }
      // At most a handful of deliberate omissions (build script: ≤ 2 %).
      const total = index.packs.reduce((n, p) => n + p.count, 0);
      const enTotal = enIndex.packs.reduce((n, p) => n + p.count, 0);
      expect(total).toBeGreaterThanOrEqual(enTotal * 0.98);
    }
  });

  test("every bundled and English pack question has a source", () => {
    const sources = readJson("content/quiz/sources.json");
    const enPackIds = parseQuizIndex(
      readJson("content/quiz/en/index.json"),
      "en"
    ).packs.flatMap((entry) =>
      readJson(`content/quiz/en/${entry.file}`).questions.map(
        (q: WorldQuestion) => q.id
      )
    );
    for (const id of [...enIds, ...enPackIds]) {
      expect(typeof sources[id]).toBe("string");
    }
  });
});
