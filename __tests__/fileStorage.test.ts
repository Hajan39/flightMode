const mockFiles = new Map<string, string>();
/** When set, the next tmp write "crashes" after writing this partial text. */
const mockFs = {
  crashOnWrite: null as string | null,
  log: [] as string[],
  moveFails: false as boolean,
  writeDelayMs: 0,
};
jest.mock("expo-file-system/legacy", () => ({
  deleteAsync: (uri: string) => {
    mockFiles.delete(uri);
    return Promise.resolve();
  },
  documentDirectory: "file:///docs/",
  getInfoAsync: async (uri: string) => ({ exists: mockFiles.has(uri) }),
  moveAsync: ({ from, to }: { from: string; to: string }) => {
    if (mockFs.moveFails) {
      return Promise.reject(new Error("move failed"));
    }
    const value = mockFiles.get(from);
    if (value === undefined) {
      return Promise.reject(new Error("no source"));
    }
    mockFiles.set(to, value);
    mockFiles.delete(from);
    mockFs.log.push(`move ${to}`);
    return Promise.resolve();
  },
  readAsStringAsync: (uri: string) => {
    const value = mockFiles.get(uri);
    if (value === undefined) {
      return Promise.reject(new Error("missing"));
    }
    mockFs.log.push(`read ${uri}`);
    return Promise.resolve(value);
  },
  writeAsStringAsync: async (uri: string, value: string) => {
    if (mockFs.writeDelayMs > 0) {
      await new Promise((r) => setTimeout(r, mockFs.writeDelayMs));
    }
    if (mockFs.crashOnWrite !== null) {
      mockFiles.set(uri, mockFs.crashOnWrite);
      mockFs.crashOnWrite = null;
      throw new Error("killed mid-write");
    }
    mockFiles.set(uri, value);
    mockFs.log.push(`write ${uri}=${value}`);
  },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";

import { fileStorage } from "@/utils/fileStorage";

const FILE = "file:///docs/persist_k.json";
const TMP = `${FILE}.tmp`;

beforeEach(() => {
  mockFiles.clear();
  mockFs.crashOnWrite = null;
  mockFs.log = [];
  mockFs.moveFails = false;
  mockFs.writeDelayMs = 0;
});

describe("fileStorage", () => {
  test("migrates a value from AsyncStorage into a file on first read", async () => {
    await AsyncStorage.setItem("content_sync", '{"state":{"items":[]}}');
    expect(await fileStorage.getItem("content_sync")).toBe(
      '{"state":{"items":[]}}'
    );
    expect(mockFiles.get("file:///docs/persist_content_sync.json")).toBe(
      '{"state":{"items":[]}}'
    );
    expect(await AsyncStorage.getItem("content_sync")).toBeNull();
  });

  test("round-trips through the file and removes it", async () => {
    await fileStorage.setItem("k", "v");
    expect(await fileStorage.getItem("k")).toBe("v");
    await fileStorage.removeItem("k");
    expect(await fileStorage.getItem("k")).toBeNull();
  });

  test("writes go to a .tmp file and are renamed over the real one", async () => {
    await fileStorage.setItem("k", "v1");
    expect(mockFs.log).toEqual([`write ${TMP}=v1`, `move ${FILE}`]);
    expect(mockFiles.has(TMP)).toBe(false);
  });

  test("a write killed midway leaves the previous value intact", async () => {
    await fileStorage.setItem("k", "old");
    mockFs.crashOnWrite = '{"state":{"ite';
    await expect(fileStorage.setItem("k", "new")).rejects.toThrow(
      "killed mid-write"
    );
    expect(mockFiles.get(FILE)).toBe("old");
    // The partial .tmp is ignored and cleaned up on the next read.
    expect(await fileStorage.getItem("k")).toBe("old");
    expect(mockFiles.has(TMP)).toBe(false);
  });

  test("a complete .tmp without the real file (iOS remove→move gap) is promoted", async () => {
    mockFiles.set(TMP, '{"state":{"n":1}}');
    expect(await fileStorage.getItem("k")).toBe('{"state":{"n":1}}');
    expect(mockFiles.get(FILE)).toBe('{"state":{"n":1}}');
    expect(mockFiles.has(TMP)).toBe(false);
  });

  test("a partial .tmp without the real file is discarded, not promoted", async () => {
    mockFiles.set(TMP, '{"state":{"ite');
    expect(await fileStorage.getItem("k")).toBeNull();
    expect(mockFiles.has(FILE)).toBe(false);
    expect(mockFiles.has(TMP)).toBe(false);
  });

  test("a partial .tmp falls through to the AsyncStorage migration", async () => {
    await AsyncStorage.setItem("k", '{"state":{"legacy":true}}');
    mockFiles.set(TMP, '{"state":{"ite');
    expect(await fileStorage.getItem("k")).toBe('{"state":{"legacy":true}}');
    expect(mockFiles.get(FILE)).toBe('{"state":{"legacy":true}}');
    expect(mockFiles.has(TMP)).toBe(false);
    expect(await AsyncStorage.getItem("k")).toBeNull();
  });

  test("operations on a key are serialized; a superseded write is skipped", async () => {
    mockFs.writeDelayMs = 5;
    const a = fileStorage.setItem("k", "a");
    // Let "a" start (it is now inside the slow tmp write).
    await new Promise((r) => setTimeout(r, 1));
    const b = fileStorage.setItem("k", "b");
    const c = fileStorage.setItem("k", "c");
    const read = fileStorage.getItem("k");
    await Promise.all([a, b, c]);
    expect(await read).toBe("c");
    // "a" finished first (no interleaving); "b" was superseded by "c".
    expect(mockFs.log.filter((l) => !l.startsWith("read"))).toEqual([
      `write ${TMP}=a`,
      `move ${FILE}`,
      `write ${TMP}=c`,
      `move ${FILE}`,
    ]);
  });

  test("a failed write does not block later operations on the key", async () => {
    mockFs.moveFails = true;
    await expect(fileStorage.setItem("k", "x")).rejects.toThrow("move failed");
    mockFs.moveFails = false;
    await fileStorage.setItem("k", "y");
    expect(await fileStorage.getItem("k")).toBe("y");
  });
});
