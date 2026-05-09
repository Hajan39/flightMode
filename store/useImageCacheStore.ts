import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type ImageCacheState = {
	cache: Record<string, string>; // remoteUrl → localUri
	setCached: (url: string, localUri: string) => void;
	clearCache: () => Promise<void>;
};

export const useImageCacheStore = create<ImageCacheState>()(
	persist(
		(set) => ({
			cache: {},
			setCached: (url, localUri) =>
				set((state) => ({ cache: { ...state.cache, [url]: localUri } })),
			clearCache: async () => {
				const dir = `${FileSystem.documentDirectory}article_images/`;
				await FileSystem.deleteAsync(dir, { idempotent: true });
				set({ cache: {} });
			},
		}),
		{
			name: "image_cache",
			storage: createJSONStorage(() => AsyncStorage),
		},
	),
);
