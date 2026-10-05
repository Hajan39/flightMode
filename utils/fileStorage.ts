import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
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
		if (!uri) return AsyncStorage.getItem(name);
		const info = await FileSystem.getInfoAsync(uri);
		if (info.exists) return FileSystem.readAsStringAsync(uri);
		const legacy = await AsyncStorage.getItem(name);
		if (legacy !== null) {
			await FileSystem.writeAsStringAsync(uri, legacy);
			await AsyncStorage.removeItem(name);
		}
		return legacy;
	},
	async setItem(name, value) {
		const uri = fileUri(name);
		if (!uri) return AsyncStorage.setItem(name, value);
		await FileSystem.writeAsStringAsync(uri, value);
	},
	async removeItem(name) {
		const uri = fileUri(name);
		if (!uri) return AsyncStorage.removeItem(name);
		await FileSystem.deleteAsync(uri, { idempotent: true });
	},
};

function fileUri(name: string): string | null {
	return FileSystem.documentDirectory
		? `${FileSystem.documentDirectory}persist_${name}.json`
		: null;
}
