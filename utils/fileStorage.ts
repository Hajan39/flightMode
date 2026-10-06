import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  deleteAsync,
  documentDirectory,
  getInfoAsync,
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
 */
export const fileStorage: StateStorage = {
  async getItem(name) {
    const uri = fileUri(name);
    if (!uri) {
      return AsyncStorage.getItem(name);
    }
    const info = await getInfoAsync(uri);
    if (info.exists) {
      return readAsStringAsync(uri);
    }
    const legacy = await AsyncStorage.getItem(name);
    if (legacy !== null) {
      await writeAsStringAsync(uri, legacy);
      await AsyncStorage.removeItem(name);
    }
    return legacy;
  },
  async removeItem(name) {
    const uri = fileUri(name);
    if (!uri) {
      return AsyncStorage.removeItem(name);
    }
    await deleteAsync(uri, { idempotent: true });
  },
  async setItem(name, value) {
    const uri = fileUri(name);
    if (!uri) {
      return AsyncStorage.setItem(name, value);
    }
    await writeAsStringAsync(uri, value);
  },
};

function fileUri(name: string): string | null {
  return documentDirectory ? `${documentDirectory}persist_${name}.json` : null;
}
