import {
  deleteAsync,
  documentDirectory,
  downloadAsync,
  getInfoAsync,
  makeDirectoryAsync,
} from "expo-file-system/legacy";

const IMAGE_DIR = `${documentDirectory}article_images/`;

const UNSAFE_FILENAME_CHARS = /[^a-zA-Z0-9._-]/g;

async function ensureImageDir() {
  const info = await getInfoAsync(IMAGE_DIR);
  if (!info.exists) {
    await makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
  }
}

function urlToFilename(url: string): string {
  // Stable filename derived from the URL — last 80 chars, special chars replaced
  return url.replace(UNSAFE_FILENAME_CHARS, "_").slice(-80);
}

export async function downloadImage(url: string): Promise<string | null> {
  await ensureImageDir();

  const localUri = `${IMAGE_DIR}${urlToFilename(url)}`;

  const info = await getInfoAsync(localUri);
  if (info.exists) {
    return localUri;
  }

  try {
    const result = await downloadAsync(url, localUri);
    if (result.status === 200) {
      return result.uri;
    }
    await deleteAsync(localUri, { idempotent: true });
    return null;
  } catch {
    await deleteAsync(localUri, { idempotent: true });
    return null;
  }
}
