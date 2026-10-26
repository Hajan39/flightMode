/**
 * Model-based property test for utils/fileStorage.ts: random sequences of
 * get / set / remove / concurrent bursts with injected file-system faults
 * (failed or torn tmp writes, failed or iOS-style half-done renames) against
 * an in-memory fake FS. Checked against a reference model after every step:
 * a read returns the last acknowledged value, or a newer value whose write
 * reached the .tmp completely — never an older value, never a torn one.
 */
type WriteFault = "ok" | "fail" | "crash";
type MoveFault = "ok" | "fail" | "ios";

const mockFiles = new Map<string, string>();
const mockPlan = {
  move: [] as MoveFault[],
  write: [] as WriteFault[],
};

jest.mock("expo-file-system/legacy", () => ({
  deleteAsync: async (uri: string) => {
    await Promise.resolve();
    mockFiles.delete(uri);
  },
  documentDirectory: "file:///docs/",
  getInfoAsync: async (uri: string) => {
    await Promise.resolve();
    return { exists: mockFiles.has(uri) };
  },
  moveAsync: async ({ from, to }: { from: string; to: string }) => {
    await Promise.resolve();
    const fault = mockPlan.move.shift() ?? "ok";
    if (fault === "fail") {
      throw new Error("move failed");
    }
    if (fault === "ios") {
      // iOS replaces by removing the target first; die in between.
      mockFiles.delete(to);
      throw new Error("killed between remove and move");
    }
    const value = mockFiles.get(from);
    if (value === undefined) {
      throw new Error("no source");
    }
    mockFiles.set(to, value);
    mockFiles.delete(from);
  },
  readAsStringAsync: async (uri: string) => {
    await Promise.resolve();
    const value = mockFiles.get(uri);
    if (value === undefined) {
      throw new Error("missing");
    }
    return value;
  },
  writeAsStringAsync: async (uri: string, value: string) => {
    await Promise.resolve();
    const fault = mockPlan.write.shift() ?? "ok";
    if (fault === "fail") {
      throw new Error("disk full");
    }
    if (fault === "crash") {
      mockFiles.set(uri, value.slice(0, Math.max(1, value.length - 3)));
      throw new Error("killed mid-write");
    }
    mockFiles.set(uri, value);
  },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";

import { fileStorage } from "@/utils/fileStorage";

import { assert, forAllAsync, type Gen } from "./helpers/property";

const json = (n: number) => JSON.stringify({ state: { n }, version: 0 });

interface Fault {
  move: MoveFault;
  write: WriteFault;
}

function randomFault(g: Gen): Fault {
  if (g.bool(0.6)) {
    return { move: "ok", write: "ok" };
  }
  const write = g.pick<WriteFault>(["ok", "fail", "crash"]);
  return {
    move: write === "ok" ? g.pick<MoveFault>(["fail", "ios"]) : "ok",
    write,
  };
}

/** Did a write with this fault leave its complete value in the .tmp? */
const tmpComplete = (f: Fault) => f.write === "ok" && f.move !== "ok";
/** A fault that models the app being killed (next session starts with a read). */
const isKill = (f: Fault) => f.write === "crash" || f.move === "ios";

describe("fileStorage — model-based", () => {
  test("random get/set/remove/burst sequences with FS faults never lose the last acknowledged write (800 runs × ≤30 ops)", async () => {
    await forAllAsync("fileStorage model", 800, async (g, seed) => {
      const name = `k${seed}`;
      mockPlan.move = [];
      mockPlan.write = [];
      const legacy = g.bool(0.3) ? json(99) : null;
      if (legacy !== null) {
        await AsyncStorage.setItem(name, legacy);
      }
      /** Values a read may legitimately return right now. */
      let allowed = new Set<string | null>([legacy]);
      /** The last acknowledged value (must always stay readable). */
      let committed: string | null = legacy;
      // persist always hydrates (reads) before its first write, and that
      // first read is what migrates + removes the AsyncStorage value.
      let mustReadNext = legacy !== null;
      const log: string[] = [];
      const ops = g.int(1, 30);
      for (let i = 0; i < ops; i += 1) {
        const op = mustReadNext
          ? "get"
          : g.pick(["set", "set", "get", "get", "remove", "burst"]);
        mustReadNext = false;
        if (op === "get") {
          log.push("get");
          // biome-ignore lint/performance/noAwaitInLoops: the model steps one op at a time
          const got = await fileStorage.getItem(name);
          assert(
            allowed.has(got as string | null),
            `read ${got}, allowed ${[...allowed].join(" | ")} | ${log.join(" ")}`
          );
          assert(
            got === committed || got !== null,
            `acknowledged ${committed} lost (read null) | ${log.join(" ")}`
          );
          committed = got as string | null;
          allowed = new Set([committed]);
          continue;
        }
        if (op === "remove") {
          log.push("remove");
          await fileStorage.removeItem(name);
          committed = null;
          allowed = new Set([null]);
          continue;
        }
        const values =
          op === "burst"
            ? Array.from({ length: g.int(2, 5) }, () => json(g.int(0, 9)))
            : [json(g.int(0, 9))];
        const fault = randomFault(g);
        // Only the newest write of a burst touches the FS (documented skip).
        mockPlan.write = [fault.write];
        mockPlan.move = fault.write === "ok" ? [fault.move] : [];
        log.push(`${op}(${values.length})[${fault.write}/${fault.move}]`);
        const results = await Promise.allSettled(
          values.map((v) => fileStorage.setItem(name, v))
        );
        mockPlan.move = [];
        mockPlan.write = [];
        const last = values.at(-1) as string;
        const lastOk = results.at(-1)?.status === "fulfilled";
        const shouldAck = fault.write === "ok" && fault.move === "ok";
        assert(
          lastOk === shouldAck,
          `ack ${lastOk} for fault ${fault.write}/${fault.move}`
        );
        if (lastOk) {
          committed = last;
          allowed = new Set([last]);
        } else {
          if (tmpComplete(fault)) {
            allowed.add(last);
          }
          // A kill ends the session: the next launch reads first.
          mustReadNext = isKill(fault);
        }
      }
    });
  });
});
