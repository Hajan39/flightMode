import type { WorldQuestion } from "@/data/worldQuiz";
import { isAcceptableFeedContentType } from "@/utils/contentSync";

/**
 * Remote world-quiz packs: static JSON under `content/quiz/<lang>/` in the
 * public GitHub repo (no backend). `index.json` lists the packs with their
 * sha256; the app downloads only packs it does not have (or whose sha
 * changed). Publishing = re-run `scripts/build-quiz-data.mjs` and commit —
 * `release-main` ignores `content/**`, so no app release is triggered.
 */
export const QUIZ_FEED_BASE_URL = (
  process.env.EXPO_PUBLIC_QUIZ_FEED_URL ??
  "https://raw.githubusercontent.com/Hajan39/flightMode/main/content/quiz"
).replace(/\/+$/, "");

/** Languages with a translated server pool (all 12 app languages). */
export const QUIZ_REMOTE_LANGUAGES = [
  "en",
  "cs",
  "de",
  "es",
  "fr",
  "hi",
  "it",
  "ja",
  "ko",
  "pl",
  "pt",
  "zh",
] as const;
export type QuizRemoteLanguage = (typeof QUIZ_REMOTE_LANGUAGES)[number];

export function isQuizRemoteLanguage(
  language: string
): language is QuizRemoteLanguage {
  return (QUIZ_REMOTE_LANGUAGES as readonly string[]).includes(language);
}

/** Keep in sync with LIMITS in scripts/build-quiz-data.mjs. */
export const QUIZ_LIMITS = {
  category: 40,
  explanation: 300,
  option: 60,
  question: 200,
} as const;
/** Sanity caps: a broken / hostile index must not make the app download MBs. */
export const MAX_PACKS = 60;
export const MAX_PACK_QUESTIONS = 500;

const ID_RE = /^[a-z0-9-]{1,32}$/;
const PACK_FILE_RE = /^pack-\d{3,4}\.json$/;
const SHA_RE = /^[0-9a-f]{64}$/;

export const QUIZ_HEADER_TIMEOUT_MS = 8000;
export const QUIZ_BODY_TIMEOUT_MS = 30_000;

export interface QuizPackEntry {
  count: number;
  file: string;
  id: string;
  sha256: string;
}

export interface QuizIndex {
  lang: string;
  packs: QuizPackEntry[];
  version: string;
}

export interface QuizValidators {
  etag: string | null;
  lastModified: string | null;
}

/** A downloaded pack as stored on the device. */
export interface StoredQuizPack {
  id: string;
  questions: WorldQuestion[];
  sha256: string;
}

const isNonEmpty = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;

/** Schema check for one question (4 distinct options, answer 0–3, lengths). */
export function isWorldQuestion(value: unknown): value is WorldQuestion {
  const q = value as Partial<WorldQuestion> | null;
  if (!q || typeof q !== "object") {
    return false;
  }
  return (
    typeof q.id === "string" &&
    ID_RE.test(q.id) &&
    isNonEmpty(q.category, QUIZ_LIMITS.category) &&
    (q.difficulty === 1 || q.difficulty === 2 || q.difficulty === 3) &&
    isNonEmpty(q.question, QUIZ_LIMITS.question) &&
    Array.isArray(q.options) &&
    q.options.length === 4 &&
    q.options.every((o) => isNonEmpty(o, QUIZ_LIMITS.option)) &&
    new Set(q.options.map((o) => (o as string).trim())).size === 4 &&
    Number.isInteger(q.answer) &&
    (q.answer as number) >= 0 &&
    (q.answer as number) <= 3 &&
    typeof q.explanation === "string" &&
    q.explanation.length <= QUIZ_LIMITS.explanation
  );
}

/** Only the app fields (extra keys from the file are not kept). */
function toWorldQuestion(q: WorldQuestion): WorldQuestion {
  return {
    answer: q.answer,
    category: q.category,
    difficulty: q.difficulty,
    explanation: q.explanation,
    id: q.id,
    options: [...q.options],
    question: q.question,
  };
}

/** Validates an index; malformed pack entries are dropped. Throws when unusable. */
export function parseQuizIndex(raw: unknown, language: string): QuizIndex {
  const index = raw as Partial<QuizIndex> | null;
  if (
    !index ||
    typeof index.version !== "string" ||
    index.version.length === 0 ||
    !Array.isArray(index.packs) ||
    (index.lang !== undefined && index.lang !== language)
  ) {
    throw new Error("Quiz index is malformed");
  }
  const seen = new Set<string>();
  const packs: QuizPackEntry[] = [];
  for (const entry of index.packs.slice(0, MAX_PACKS)) {
    const p = entry as Partial<QuizPackEntry> | null;
    if (
      p &&
      typeof p.id === "string" &&
      ID_RE.test(p.id) &&
      typeof p.file === "string" &&
      PACK_FILE_RE.test(p.file) &&
      typeof p.sha256 === "string" &&
      SHA_RE.test(p.sha256) &&
      Number.isInteger(p.count) &&
      (p.count as number) > 0 &&
      (p.count as number) <= MAX_PACK_QUESTIONS &&
      !seen.has(p.id)
    ) {
      seen.add(p.id);
      packs.push({
        count: p.count as number,
        file: p.file,
        id: p.id,
        sha256: p.sha256,
      });
    }
  }
  return { lang: language, packs, version: index.version };
}

/** Valid questions of a pack; invalid / duplicate ones are dropped. */
export function parseQuizPack(raw: unknown): WorldQuestion[] {
  const pack = raw as { questions?: unknown } | null;
  if (!(pack && Array.isArray(pack.questions))) {
    throw new Error("Quiz pack is malformed");
  }
  const seen = new Set<string>();
  const out: WorldQuestion[] = [];
  for (const q of pack.questions.slice(0, MAX_PACK_QUESTIONS)) {
    if (isWorldQuestion(q) && !seen.has(q.id)) {
      seen.add(q.id);
      out.push(toWorldQuestion(q));
    }
  }
  return out;
}

/** Packs to download (new or changed sha) and stored packs to keep. */
export function planPackSync(
  index: QuizIndex,
  stored: readonly StoredQuizPack[]
): { download: QuizPackEntry[]; keep: StoredQuizPack[] } {
  const byId = new Map(stored.map((p) => [p.id, p]));
  const download: QuizPackEntry[] = [];
  const keep: StoredQuizPack[] = [];
  for (const entry of index.packs) {
    const have = byId.get(entry.id);
    if (have && have.sha256 === entry.sha256) {
      keep.push(have);
    } else {
      download.push(entry);
    }
  }
  return { download, keep };
}

export function quizIndexUrl(language: QuizRemoteLanguage) {
  return `${QUIZ_FEED_BASE_URL}/${language}/index.json`;
}

export function quizPackUrl(language: QuizRemoteLanguage, file: string) {
  return `${QUIZ_FEED_BASE_URL}/${language}/${file}`;
}

export interface QuizIndexOutcome {
  index: QuizIndex | null;
  /** 304: unchanged since the validators were issued. */
  notModified: boolean;
  /** 404: nothing published for this language yet. */
  notPublished: boolean;
  validators: QuizValidators;
}

/**
 * GET with a header timeout and a body timeout (raced as well as aborted,
 * so a fetch that ignores the signal still settles).
 */
async function timedFetch<T>(
  url: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch,
  handle: (response: Response, readJson: () => Promise<unknown>) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectTimeout: (error: Error) => void = () => undefined;
  const timeout = new Promise<never>((_, reject) => {
    rejectTimeout = reject;
  });
  const arm = (ms: number, phase: string) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      controller.abort();
      rejectTimeout(new Error(`Quiz sync timed out (${phase})`));
    }, ms);
  };
  arm(QUIZ_HEADER_TIMEOUT_MS, "headers");
  try {
    return await Promise.race([
      (async () => {
        const response = await fetchImpl(url, {
          headers,
          signal: controller.signal,
        });
        return handle(response, async () => {
          if (
            !isAcceptableFeedContentType(response.headers.get("content-type"))
          ) {
            throw new Error("Quiz data is not JSON");
          }
          arm(QUIZ_BODY_TIMEOUT_MS, "body");
          try {
            return await response.json();
          } catch (error) {
            throw new Error("Quiz data is not JSON", { cause: error });
          }
        });
      })(),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Conditional GET of `<lang>/index.json` (If-None-Match / If-Modified-Since). */
export function fetchQuizIndex(
  language: QuizRemoteLanguage,
  validators: QuizValidators | null,
  fetchImpl: typeof fetch = fetch
): Promise<QuizIndexOutcome> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (validators?.etag) {
    headers["If-None-Match"] = validators.etag;
  }
  if (validators?.lastModified) {
    headers["If-Modified-Since"] = validators.lastModified;
  }
  return timedFetch(
    quizIndexUrl(language),
    headers,
    fetchImpl,
    async (response, readJson) => {
      if (response.status === 304) {
        return {
          index: null,
          notModified: true,
          notPublished: false,
          validators: {
            etag: response.headers.get("etag") ?? validators?.etag ?? null,
            lastModified:
              response.headers.get("last-modified") ??
              validators?.lastModified ??
              null,
          },
        };
      }
      if (response.status === 404) {
        return {
          index: null,
          notModified: false,
          notPublished: true,
          validators: { etag: null, lastModified: null },
        };
      }
      if (!response.ok) {
        throw new Error(`Quiz index failed with status ${response.status}`);
      }
      const index = parseQuizIndex(await readJson(), language);
      return {
        index,
        notModified: false,
        notPublished: false,
        validators: {
          etag: response.headers.get("etag"),
          lastModified: response.headers.get("last-modified"),
        },
      };
    }
  );
}

/** Downloads one pack and returns its valid questions. */
export function fetchQuizPack(
  language: QuizRemoteLanguage,
  entry: QuizPackEntry,
  fetchImpl: typeof fetch = fetch
): Promise<StoredQuizPack> {
  return timedFetch(
    quizPackUrl(language, entry.file),
    { Accept: "application/json" },
    fetchImpl,
    async (response, readJson) => {
      if (!response.ok) {
        throw new Error(`Quiz pack failed with status ${response.status}`);
      }
      return {
        id: entry.id,
        questions: parseQuizPack(await readJson()),
        sha256: entry.sha256,
      };
    }
  );
}
