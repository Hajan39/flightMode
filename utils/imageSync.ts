import {
  createDownloadResumable,
  deleteAsync,
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
} from "expo-file-system/legacy";

const IMAGE_DIR = `${documentDirectory}article_images/`;

/** Article hero images are a few hundred KB; anything far larger is not one. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const HTTPS_URL_RE = /^https:\/\/[^\s/?#@]+(?:[/?#]\S*)?$/i;
const IMAGE_EXTENSIONS = new Set(["avif", "gif", "jpeg", "jpg", "png", "webp"]);
const EXTENSION_RE = /\.([a-z0-9]{2,5})$/i;
const QUERY_OR_HASH_RE = /[?#].*$/;

/** Only plain https URLs (no other schemes, no `user@host` credentials). */
export function isAllowedImageUrl(url: unknown): url is string {
  return typeof url === "string" && HTTPS_URL_RE.test(url);
}

/** 64-bit FNV-1a (two 32-bit lanes) as 16 hex chars — stable across runs. */
export function hashUrl(url: string): string {
  let a = 0x81_1c_9d_c5;
  let b = 0x01_00_01_93;
  for (let i = 0; i < url.length; i += 1) {
    const code = url.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01_00_01_93);
    b = Math.imul(b ^ code, 0x01_00_01_b3) + i;
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return `${hex(a)}${hex(b)}`;
}

/** File name = hash of the full URL (no collisions from shared suffixes) + known image extension. */
export function imageFilenameForUrl(url: string): string {
  const path = url.replace(QUERY_OR_HASH_RE, "");
  const ext = EXTENSION_RE.exec(path)?.[1]?.toLowerCase();
  return ext && IMAGE_EXTENSIONS.has(ext)
    ? `${hashUrl(url)}.${ext}`
    : hashUrl(url);
}

async function ensureImageDir() {
  const info = await getInfoAsync(IMAGE_DIR);
  if (!info.exists) {
    await makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
  }
}

function headerValue(headers: Record<string, string>, name: string) {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return key ? headers[key] : undefined;
}

export async function downloadImage(url: string): Promise<string | null> {
  if (!isAllowedImageUrl(url)) {
    return null;
  }
  await ensureImageDir();

  const localUri = `${IMAGE_DIR}${imageFilenameForUrl(url)}`;

  const info = await getInfoAsync(localUri);
  if (info.exists) {
    return localUri;
  }

  let tooLarge = false;
  const task = createDownloadResumable(url, localUri, {}, (progress) => {
    if (
      !tooLarge &&
      (progress.totalBytesExpectedToWrite > MAX_IMAGE_BYTES ||
        progress.totalBytesWritten > MAX_IMAGE_BYTES)
    ) {
      tooLarge = true;
      // biome-ignore lint/complexity/noVoid: stop the transfer; the result below is discarded
      void task.cancelAsync().catch(() => undefined);
    }
  });

  try {
    const result = await task.downloadAsync();
    const contentType = result
      ? (headerValue(result.headers, "content-type") ?? "")
      : "";
    if (
      result &&
      !tooLarge &&
      result.status === 200 &&
      // A captive portal answers with an HTML page — never cache that as an image.
      (contentType === "" || contentType.toLowerCase().startsWith("image/"))
    ) {
      const saved = await getInfoAsync(localUri);
      if (saved.exists && saved.size <= MAX_IMAGE_BYTES) {
        return result.uri;
      }
    }
    await deleteAsync(localUri, { idempotent: true });
    return null;
  } catch {
    await deleteAsync(localUri, { idempotent: true });
    return null;
  }
}
