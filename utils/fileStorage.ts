import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  deleteAsync,
  documentDirectory,
  getInfoAsync,
  moveAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from "expo-file-system/legacy";
import type { StateStorage } from "zustand/middleware";

/**
 * zustand `StateStorage` backed by one file per key in the document directory.
 * For large persisted state (the synced article feed): Android AsyncStorage
 * can't read a value over ~2 MB (CursorWindow) and caps the whole DB at 6 MB.
 * Falls back to AsyncStorage where there is no file system (web), and migrates
 * a value previously stored in AsyncStorage on first read.
 *
 * Durability:
 * - Writes are atomic: the value goes to `<file>.tmp` first and is then
 *   renamed over the real file, so a kill mid-write leaves the previous
 *   value intact (Android `renameTo` replaces atomically; iOS removes the
 *   target then moves — the complete `.tmp` survives that gap and is
 *   promoted on the next read, if it parses as JSON).
 * - Operations per key are serialized (a read never sees a half-written
 *   file), and a write superseded by a newer queued one is skipped.
 */
export const fileStorage: StateStorage = {
  getItem(name) {
    const uri = fileUri(name);
    if (!uri) {
      return AsyncStorage.getItem(name);
    }
    return serialize(name, () => readFile(name, uri));
  },
  removeItem(name) {
    const uri = fileUri(name);
    if (!uri) {
      return AsyncStorage.removeItem(name);
    }
    return serialize(name, async () => {
      await deleteAsync(uri, { idempotent: true });
      await deleteAsync(tmpUri(uri), { idempotent: true });
    });
  },
  setItem(name, value) {
    const uri = fileUri(name);
    if (!uri) {
      return AsyncStorage.setItem(name, value);
    }
    const seq = (writeSeq.get(name) ?? 0) + 1;
    writeSeq.set(name, seq);
    return serialize(name, async () => {
      if (writeSeq.get(name) !== seq) {
        return; // a newer value is queued behind us — write only that one
      }
      await writeAtomically(uri, value);
    });
  },
};

const tails = new Map<string, Promise<unknown>>();
const writeSeq = new Map<string, number>();

/** Runs `task` after every earlier operation on the same key settled. */
function serialize<T>(name: string, task: () => Promise<T>): Promise<T> {
  const previous = tails.get(name) ?? Promise.resolve();
  const run = previous.then(task, task);
  tails.set(
    name,
    run.catch(() => undefined)
  );
  return run;
}

async function readFile(name: string, uri: string): Promise<string | null> {
  const info = await getInfoAsync(uri);
  if (info.exists) {
    // A leftover .tmp next to an existing file is an interrupted write
    // (possibly partial) — the real file is the last complete value.
    await deleteAsync(tmpUri(uri), { idempotent: true });
    return readAsStringAsync(uri);
  }
  const tmp = tmpUri(uri);
  const tmpInfo = await getInfoAsync(tmp);
  if (tmpInfo.exists) {
    // Killed between "remove target" and "move" (iOS): the .tmp is complete —
    // unless the app died during the tmp write of a first-ever save (no real
    // file yet). Only valid JSON is promoted; a partial .tmp is discarded and
    // the read falls through to the AsyncStorage migration below.
    const text = await readAsStringAsync(tmp);
    if (isJson(text)) {
      await moveAsync({ from: tmp, to: uri });
      return text;
    }
    await deleteAsync(tmp, { idempotent: true });
  }
  const legacy = await AsyncStorage.getItem(name);
  if (legacy !== null) {
    await writeAtomically(uri, legacy);
    await AsyncStorage.removeItem(name);
  }
  return legacy;
}

async function writeAtomically(uri: string, value: string) {
  const tmp = tmpUri(uri);
  await writeAsStringAsync(tmp, value);
  await moveAsync({ from: tmp, to: uri });
}

function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function tmpUri(uri: string) {
  return `${uri}.tmp`;
}

function fileUri(name: string): string | null {
  return documentDirectory ? `${documentDirectory}persist_${name}.json` : null;
}
