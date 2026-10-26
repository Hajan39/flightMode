import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteAsync, documentDirectory } from "expo-file-system/legacy";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { safePersistOptions } from "@/utils/persistStorage";

const IMAGE_DIR_NAME = "article_images/";
const QUERY_OR_HASH_RE = /[?#].*$/;

interface ImageCacheState {
  /**
   * remoteUrl → file name inside `<documentDirectory>article_images/`. Only
   * the name is stored: on iOS the app container path (and with it every
   * absolute URI) changes on app updates. Resolve with `cachedImageUri()`.
   */
  cache: Record<string, string>;
  clearCache: () => Promise<void>;
  /** Accepts a full local URI or a bare file name; stores the file name. */
  setCached: (url: string, localUriOrName: string) => void;
}

/** Last path segment: `file:///…/article_images/ab12.png` → `ab12.png`. */
export function imageFileName(localUriOrName: string): string {
  const withoutQuery = localUriOrName.replace(QUERY_OR_HASH_RE, "");
  const slash = withoutQuery.lastIndexOf("/");
  return slash === -1 ? withoutQuery : withoutQuery.slice(slash + 1);
}

/** Absolute file URI of a cached image for the current app container. */
export function cachedImageUri(fileName: string): string | null {
  if (!(documentDirectory && fileName)) {
    return null;
  }
  return `${documentDirectory}${IMAGE_DIR_NAME}${imageFileName(fileName)}`;
}

/** v0 stored absolute URIs → keep only the file names. */
export function migrateImageCache(
  persisted: unknown,
  fromVersion: number
): { cache: Record<string, string> } {
  const raw = (persisted as { cache?: unknown } | null)?.cache;
  const cache: Record<string, string> = {};
  if (raw && typeof raw === "object") {
    for (const [url, value] of Object.entries(raw)) {
      if (typeof value === "string" && value) {
        cache[url] = fromVersion < 1 ? imageFileName(value) : value;
      }
    }
  }
  return { ...(persisted as object), cache };
}

export const useImageCacheStore = create<ImageCacheState>()(
  persist(
    (set) => ({
      cache: {},
      clearCache: async () => {
        const dir = `${documentDirectory}${IMAGE_DIR_NAME}`;
        await deleteAsync(dir, { idempotent: true });
        set({ cache: {} });
      },
      setCached: (url, localUriOrName) =>
        set((state) => ({
          cache: { ...state.cache, [url]: imageFileName(localUriOrName) },
        })),
    }),
    safePersistOptions(() => AsyncStorage, {
      migrate: (persisted, version) =>
        migrateImageCache(persisted, version) as unknown as ImageCacheState,
      name: "image_cache",
      version: 1,
    })
  )
);
