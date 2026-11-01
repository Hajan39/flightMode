/**
 * World-quiz remote packs: parsing/validation (utils/quizSync.ts) and the
 * sync store (store/useQuizPackStore.ts) — policy gating, hydration gating,
 * cooldown, ETag/304, 404, partial failure — plus quiz store defaults.
 */
const mockFiles = new Map<string, string>();
jest.mock("expo-file-system/legacy", () => ({
  deleteAsync: (uri: string) => {
    mockFiles.delete(uri);
    return Promise.resolve();
  },
  documentDirectory: "file:///docs/",
  getInfoAsync: async (uri: string) => ({ exists: mockFiles.has(uri) }),
  moveAsync: ({ from, to }: { from: string; to: string }) => {
    mockFiles.set(to, mockFiles.get(from) ?? "");
    mockFiles.delete(from);
    return Promise.resolve();
  },
  readAsStringAsync: async (uri: string) => mockFiles.get(uri),
  writeAsStringAsync: (uri: string, value: string) => {
    mockFiles.set(uri, value);
    return Promise.resolve();
  },
}));
jest.mock("@/utils/analytics", () => ({ captureAnalyticsEvent: jest.fn() }));

import type { WorldQuestion } from "@/data/worldQuiz";
import {
  fetchQuizIndex,
  isWorldQuestion,
  parseQuizIndex,
  parseQuizPack,
  planPackSync,
} from "@/utils/quizSync";

const EN_INDEX_URL = /content\/quiz\/en\/index\.json$/;
const INDEX_URL = /index\.json$/;
const PACK_2_URL = /pack-002\.json$/;
const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);

const question = (id: string, patch: Partial<WorldQuestion> = {}) => ({
  answer: 2,
  category: "geography",
  difficulty: 1,
  explanation: "fact",
  id,
  options: ["w", "x", "y", "z"],
  question: "Which?",
  ...patch,
});

function response(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  const h = new Map(
    Object.entries({ "content-type": "text/plain", ...headers }).map(
      ([k, v]) => [k.toLowerCase(), v]
    )
  );
  return {
    headers: { get: (k: string) => h.get(k.toLowerCase()) ?? null },
    json: async () => body,
    ok: status >= 200 && status < 300,
    status,
  } as unknown as Response;
}

describe("validation", () => {
  test("isWorldQuestion enforces schema, 4 distinct options, answer 0–3, lengths", () => {
    expect(isWorldQuestion(question("geo-0001"))).toBe(true);
    const bad = [
      question("geo-0001", { answer: 4 }),
      question("geo-0001", { answer: -1 }),
      question("geo-0001", { answer: 1.5 }),
      question("geo-0001", { options: ["a", "b", "c"] }),
      question("geo-0001", { options: ["a", "a", "c", "d"] }),
      question("geo-0001", { options: ["a", "", "c", "d"] }),
      question("geo-0001", { question: "x".repeat(201) }),
      question("geo-0001", { options: ["a", "b", "c", "d".repeat(61)] }),
      question("geo-0001", { explanation: "e".repeat(301) }),
      question("geo-0001", { difficulty: 4 as never }),
      question("GEO 1"),
      null,
      "text",
    ];
    for (const q of bad) {
      expect(isWorldQuestion(q)).toBe(false);
    }
  });

  test("parseQuizPack drops invalid and duplicate questions, keeps app fields", () => {
    const out = parseQuizPack({
      questions: [
        { ...question("geo-0001"), source: "https://x", tags: ["t"] },
        question("geo-0002", { answer: 9 }),
        question("geo-0001"),
        question("geo-0003"),
      ],
    });
    expect(out.map((q) => q.id)).toEqual(["geo-0001", "geo-0003"]);
    expect(Object.keys(out[0]).sort()).toEqual([
      "answer",
      "category",
      "difficulty",
      "explanation",
      "id",
      "options",
      "question",
    ]);
    expect(() => parseQuizPack({})).toThrow();
  });

  test("parseQuizIndex drops malformed pack entries and rejects a wrong language", () => {
    const index = parseQuizIndex(
      {
        lang: "cs",
        packs: [
          { count: 250, file: "pack-001.json", id: "pack-001", sha256: SHA_A },
          { count: 250, file: "../evil.json", id: "pack-002", sha256: SHA_A },
          { count: 0, file: "pack-003.json", id: "pack-003", sha256: SHA_A },
          { count: 5, file: "pack-004.json", id: "pack-004", sha256: "nope" },
          { count: 5, file: "pack-001.json", id: "pack-001", sha256: SHA_A },
        ],
        version: "v1",
      },
      "cs"
    );
    expect(index.packs.map((p) => p.id)).toEqual(["pack-001"]);
    expect(() =>
      parseQuizIndex({ lang: "de", packs: [], version: "v" }, "cs")
    ).toThrow();
    expect(() => parseQuizIndex({ packs: [] }, "cs")).toThrow();
  });

  test("planPackSync downloads new / changed packs and keeps unchanged ones", () => {
    const plan = planPackSync(
      {
        lang: "en",
        packs: [
          { count: 1, file: "pack-001.json", id: "pack-001", sha256: SHA_A },
          { count: 1, file: "pack-002.json", id: "pack-002", sha256: SHA_B },
          { count: 1, file: "pack-003.json", id: "pack-003", sha256: SHA_A },
        ],
        version: "v2",
      },
      [
        { id: "pack-001", questions: [], sha256: SHA_A },
        { id: "pack-002", questions: [], sha256: SHA_A },
        { id: "pack-009", questions: [], sha256: SHA_A },
      ]
    );
    expect(plan.keep.map((p) => p.id)).toEqual(["pack-001"]);
    expect(plan.download.map((p) => p.id)).toEqual(["pack-002", "pack-003"]);
  });
});

describe("fetchQuizIndex", () => {
  test("sends ETag validators and handles 304", async () => {
    const fetchImpl = jest.fn(async () => response(304, null));
    const out = await fetchQuizIndex(
      "en",
      { etag: '"e1"', lastModified: "Mon" },
      fetchImpl as never
    );
    expect(out.notModified).toBe(true);
    expect(out.validators.etag).toBe('"e1"');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(url).toMatch(EN_INDEX_URL);
    expect(init.headers["If-None-Match"]).toBe('"e1"');
    expect(init.headers["If-Modified-Since"]).toBe("Mon");
  });

  test("404 = nothing published; HTML is rejected", async () => {
    const notFound = await fetchQuizIndex("de", null, (async () =>
      response(404, null)) as never);
    expect(notFound.notPublished).toBe(true);
    await expect(
      fetchQuizIndex("de", null, (async () =>
        response(200, {}, { "content-type": "text/html" })) as never)
    ).rejects.toThrow("not JSON");
  });
});

/* ------------------------------------------------------------- stores */

const flush = async (times = 30) => {
  for (let i = 0; i < times; i += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: draining the microtask queue on purpose
    await Promise.resolve();
  }
};

function asyncStorage() {
  const mod = require("@react-native-async-storage/async-storage");
  return (mod.default ??
    mod) as typeof import("@react-native-async-storage/async-storage").default;
}

const PACK_FILE = "file:///docs/persist_quiz_packs.json";
const INDEX = {
  lang: "en",
  packs: [
    { count: 2, file: "pack-001.json", id: "pack-001", sha256: SHA_A },
    { count: 1, file: "pack-002.json", id: "pack-002", sha256: SHA_B },
  ],
  version: "v1",
};
const PACKS: Record<string, unknown> = {
  "pack-001.json": {
    questions: [question("geo-0101"), question("geo-0102", { answer: 7 })],
  },
  "pack-002.json": { questions: [question("geo-0201")] },
};

let fetchMock: jest.Mock;
function serve(
  handler: (
    url: string,
    init?: { headers?: Record<string, string> }
  ) => Response
) {
  fetchMock = jest.fn(async (url: string, init) => handler(url, init));
  Object.defineProperty(global, "fetch", {
    configurable: true,
    value: fetchMock,
    writable: true,
  });
}
const defaultHandler = (url: string) => {
  if (url.endsWith("index.json")) {
    return response(200, INDEX, { etag: '"idx1"' });
  }
  const file = url.split("/").pop() as string;
  return PACKS[file] ? response(200, PACKS[file]) : response(404, null);
};

async function loadStores(policy = "wifi_and_mobile") {
  await asyncStorage().setItem(
    "settings",
    JSON.stringify({ state: { syncNetworkPolicy: policy }, version: 0 })
  );
  const { useQuizPackStore, resetQuizSyncBackoff } =
    require("@/store/useQuizPackStore") as typeof import("@/store/useQuizPackStore");
  const { useNetworkStore } =
    require("@/store/useNetworkStore") as typeof import("@/store/useNetworkStore");
  const { useSettingsStore } =
    require("@/store/useSettingsStore") as typeof import("@/store/useSettingsStore");
  useNetworkStore.setState({
    isInternetReachable: true,
    type: "WIFI",
  } as never);
  resetQuizSyncBackoff();
  await flush();
  return { useNetworkStore, useQuizPackStore, useSettingsStore };
}

beforeEach(async () => {
  jest.resetModules();
  mockFiles.clear();
  await asyncStorage().clear();
  serve(defaultHandler);
});

describe("useQuizPackStore sync", () => {
  test("hydration defaults: no packs, no language", async () => {
    const { useQuizPackStore } = await loadStores();
    const s = useQuizPackStore.getState();
    expect(useQuizPackStore.persist.hasHydrated()).toBe(true);
    expect(s.packs).toEqual([]);
    expect(s.lang).toBeNull();
    expect(s.lastSyncAt).toBeNull();
  });

  test("downloads packs, drops invalid questions, stores them in a file", async () => {
    const { useQuizPackStore } = await loadStores();
    await useQuizPackStore.getState().syncQuizPacks("en");
    const s = useQuizPackStore.getState();
    expect(s.status).toBe("success");
    expect(s.lang).toBe("en");
    expect(s.version).toBe("v1");
    expect(s.etag).toBe('"idx1"');
    expect(s.packs.map((p) => p.id)).toEqual(["pack-001", "pack-002"]);
    expect(s.packs[0].questions.map((q) => q.id)).toEqual(["geo-0101"]);
    await flush();
    expect(mockFiles.get(PACK_FILE)).toContain("geo-0201");
    const { captureAnalyticsEvent } = require("@/utils/analytics");
    expect(captureAnalyticsEvent).toHaveBeenCalledWith(
      "quiz_pack_sync_result",
      {
        packs: 2,
        result: "updated",
      }
    );
  });

  test("Online Sync off / wifi_only on mobile: no request", async () => {
    const { useQuizPackStore } = await loadStores("off");
    await useQuizPackStore.getState().syncQuizPacks("en");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useQuizPackStore.getState().status).toBe("skipped");

    jest.resetModules();
    await asyncStorage().clear();
    const stores = await loadStores("wifi_only");
    stores.useNetworkStore.setState({
      isInternetReachable: true,
      type: "CELLULAR",
    } as never);
    await stores.useQuizPackStore.getState().syncQuizPacks("en");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("languages without a server pool never fetch", async () => {
    const { useQuizPackStore } = await loadStores();
    // Every app language has a server pool now; an unknown code has none.
    await useQuizPackStore.getState().syncQuizPacks("xx");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useQuizPackStore.getState().status).toBe("skipped");
  });

  test("24 h cooldown per language; a language change syncs at once", async () => {
    const { useQuizPackStore } = await loadStores();
    await useQuizPackStore.getState().syncQuizPacks("en");
    const calls = fetchMock.mock.calls.length;
    useQuizPackStore.setState({ status: "idle" });
    await useQuizPackStore.getState().syncQuizPacks("en");
    expect(fetchMock.mock.calls.length).toBe(calls);
    expect(useQuizPackStore.getState().status).toBe("skipped");

    serve((url) =>
      url.includes("/cs/") ? response(404, null) : defaultHandler(url)
    );
    await useQuizPackStore.getState().syncQuizPacks("cs");
    expect(fetchMock).toHaveBeenCalled();
    const s = useQuizPackStore.getState();
    expect(s.lang).toBe("cs");
    expect(s.packs).toEqual([]); // English packs are not kept for Czech
  });

  test("after the cooldown: conditional request, 304 keeps the packs", async () => {
    const { useQuizPackStore } = await loadStores();
    await useQuizPackStore.getState().syncQuizPacks("en");
    useQuizPackStore.setState({
      lastSyncAt: Date.now() - 25 * 60 * 60 * 1000,
      status: "idle",
    });
    serve((url, init) => {
      expect(url).toMatch(INDEX_URL);
      expect(init?.headers?.["If-None-Match"]).toBe('"idx1"');
      return response(304, null);
    });
    await useQuizPackStore.getState().syncQuizPacks("en");
    const s = useQuizPackStore.getState();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(s.status).toBe("success");
    expect(s.packs).toHaveLength(2);
    expect(Date.now() - (s.lastSyncAt ?? 0)).toBeLessThan(1000);
  });

  test("only changed packs are downloaded again", async () => {
    const { useQuizPackStore } = await loadStores();
    await useQuizPackStore.getState().syncQuizPacks("en");
    useQuizPackStore.setState({ lastSyncAt: 0, status: "idle" });
    const changed = {
      ...INDEX,
      packs: [INDEX.packs[0], { ...INDEX.packs[1], sha256: "c".repeat(64) }],
      version: "v2",
    };
    serve((url) =>
      url.endsWith("index.json") ? response(200, changed) : defaultHandler(url)
    );
    await useQuizPackStore.getState().syncQuizPacks("en");
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.filter((u) => u.includes("pack-"))).toEqual([
      expect.stringMatching(PACK_2_URL),
    ]);
    expect(useQuizPackStore.getState().version).toBe("v2");
  });

  test("a failed pack keeps what arrived and clears the validators", async () => {
    serve((url) =>
      url.endsWith("pack-002.json") ? response(500, null) : defaultHandler(url)
    );
    const { useQuizPackStore } = await loadStores();
    await useQuizPackStore.getState().syncQuizPacks("en");
    const s = useQuizPackStore.getState();
    expect(s.status).toBe("error");
    expect(s.packs.map((p) => p.id)).toEqual(["pack-001"]);
    expect(s.etag).toBeNull();
    expect(s.version).toBeNull();
    expect(s.lastSyncAt).toBeNull(); // retried after the failure backoff
  });

  test("a sync before hydration does nothing", async () => {
    mockFiles.set(
      PACK_FILE,
      JSON.stringify({
        state: { lang: "en", lastSyncAt: Date.now(), packs: [] },
        version: 0,
      })
    );
    const { useQuizPackStore } =
      require("@/store/useQuizPackStore") as typeof import("@/store/useQuizPackStore");
    const { useSettingsStore } =
      require("@/store/useSettingsStore") as typeof import("@/store/useSettingsStore");
    expect(
      useQuizPackStore.persist.hasHydrated() &&
        useSettingsStore.persist.hasHydrated()
    ).toBe(false);
    await useQuizPackStore.getState().syncQuizPacks("en");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("a corrupt stored pack file is sanitized on hydration", async () => {
    mockFiles.set(
      PACK_FILE,
      JSON.stringify({
        state: {
          lang: "en",
          packs: [
            {
              id: "pack-001",
              questions: [question("geo-0101"), { id: "broken" }],
              sha256: SHA_A,
            },
            { id: 5 },
          ],
        },
        version: 0,
      })
    );
    const { useQuizPackStore } = await loadStores();
    const { selectDownloadedQuestions } = require("@/store/useQuizPackStore");
    const s = useQuizPackStore.getState();
    expect(s.packs).toHaveLength(1);
    expect(
      selectDownloadedQuestions(s, "en").map((q: WorldQuestion) => q.id)
    ).toEqual(["geo-0101"]);
    expect(selectDownloadedQuestions(s, "cs")).toEqual([]);
  });
});

describe("useQuizStore", () => {
  test("defaults to Mix with an empty history; bad stored data is ignored", async () => {
    await asyncStorage().setItem(
      "quiz",
      JSON.stringify({
        state: { askedWorld: { cs: "x", en: ["geo-0001", 5] }, mode: "nope" },
        version: 0,
      })
    );
    const { useQuizStore, ASKED_HISTORY_CAP } =
      require("@/store/useQuizStore") as typeof import("@/store/useQuizStore");
    await flush();
    const s = useQuizStore.getState();
    expect(s.mode).toBe("mix");
    expect(s.askedWorld).toEqual({ en: ["geo-0001"] });

    s.setAskedWorld(
      "en",
      Array.from({ length: ASKED_HISTORY_CAP + 50 }, (_, i) => `geo-${i}`)
    );
    const asked = useQuizStore.getState().askedWorld.en;
    expect(asked).toHaveLength(ASKED_HISTORY_CAP);
    expect(asked[0]).toBe("geo-50"); // oldest dropped first
  });
});
