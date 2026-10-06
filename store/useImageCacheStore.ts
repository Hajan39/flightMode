import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface ImageCacheState {
  cache: Record<string, string>; // remoteUrl → localUri
  clearCache: () => Promise<void>;
  setCached: (url: string, localUri: string) => void;
}

export const useImageCacheStore = create<ImageCacheState>()(
  persist(
    (set) => ({
      cache: {},
      clearCache: async () => {
        const dir = `${FileSystem.documentDirectory}article_images/`;
        await FileSystem.deleteAsync(dir, { idempotent: true });
        set({ cache: {} });
      },
      setCached: (url, localUri) =>
        set((state) => ({ cache: { ...state.cache, [url]: localUri } })),
    }),
    {
      name: "image_cache",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
