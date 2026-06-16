import * as FileSystem from "expo-file-system/legacy";

const IMAGE_DIR = `${FileSystem.documentDirectory}article_images/`;

async function ensureImageDir() {
	const info = await FileSystem.getInfoAsync(IMAGE_DIR);
	if (!info.exists) {
		await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
	}
}

function urlToFilename(url: string): string {
	// Stable filename derived from the URL — last 80 chars, special chars replaced
	return url.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
}

export async function downloadImage(url: string): Promise<string | null> {
	await ensureImageDir();

	const localUri = `${IMAGE_DIR}${urlToFilename(url)}`;

	const info = await FileSystem.getInfoAsync(localUri);
	if (info.exists) return localUri;

	try {
		const result = await FileSystem.downloadAsync(url, localUri);
		if (result.status === 200) return result.uri;
		await FileSystem.deleteAsync(localUri, { idempotent: true });
		return null;
	} catch {
		await FileSystem.deleteAsync(localUri, { idempotent: true });
		return null;
	}
}
