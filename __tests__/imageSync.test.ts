jest.mock("expo-file-system/legacy", () => ({
  createDownloadResumable: jest.fn(),
  deleteAsync: jest.fn(async () => undefined),
  documentDirectory: "file:///docs/",
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  makeDirectoryAsync: jest.fn(async () => undefined),
}));

import {
  createDownloadResumable,
  deleteAsync,
  getInfoAsync,
} from "expo-file-system/legacy";

import {
  downloadImage,
  hashUrl,
  imageFilenameForUrl,
  isAllowedImageUrl,
  MAX_IMAGE_BYTES,
} from "@/utils/imageSync";

const HASH_RE = /^[0-9a-f]{16}$/;
const HASH_PNG_RE = /^[0-9a-f]{16}\.png$/;

describe("image URL filter", () => {
  test("only https URLs are allowed", () => {
    expect(isAllowedImageUrl("https://images.unsplash.com/photo-1?w=800")).toBe(
      true
    );
    expect(isAllowedImageUrl("http://images.unsplash.com/photo-1")).toBe(false);
    expect(isAllowedImageUrl("file:///data/secret.png")).toBe(false);
    expect(isAllowedImageUrl("content://media/1")).toBe(false);
    expect(isAllowedImageUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedImageUrl("https://user:pw@evil.example/x.png")).toBe(false);
    expect(isAllowedImageUrl("https:///nohost")).toBe(false);
    expect(isAllowedImageUrl(undefined)).toBe(false);
  });

  test("a disallowed URL is never downloaded", async () => {
    await expect(downloadImage("http://example.com/a.png")).resolves.toBeNull();
    expect(createDownloadResumable).not.toHaveBeenCalled();
  });
});

describe("image cache file names", () => {
  test("stable hash of the full URL", () => {
    const url = "https://images.unsplash.com/photo-123?w=800&q=80";
    expect(hashUrl(url)).toBe(hashUrl(url));
    expect(hashUrl(url)).toMatch(HASH_RE);
    expect(imageFilenameForUrl(url)).toBe(hashUrl(url));
  });

  test("hash is pinned — changing it would orphan every cached image", () => {
    expect(hashUrl("https://images.unsplash.com/photo-123?w=800&q=80")).toBe(
      "9a58055087306628"
    );
  });

  test("URLs sharing a long suffix no longer collide", () => {
    const suffix = `/${"x".repeat(100)}.jpg`;
    const a = imageFilenameForUrl(`https://a.example${suffix}`);
    const b = imageFilenameForUrl(`https://b.example${suffix}`);
    expect(a).not.toBe(b);
    expect(a.endsWith(".jpg")).toBe(true);
  });

  test("only known image extensions are kept, query ignored", () => {
    expect(imageFilenameForUrl("https://x.example/a.PNG?v=2")).toMatch(
      HASH_PNG_RE
    );
    expect(imageFilenameForUrl("https://x.example/a.exe")).toMatch(HASH_RE);
  });

  test("distinct URLs in the bundled content get distinct names", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const items = require("@/data/content.json") as Array<{ image?: string }>;
    const urls = [
      ...new Set(items.map((i) => i.image).filter((u): u is string => !!u)),
    ];
    const names = new Set(urls.map(imageFilenameForUrl));
    expect(names.size).toBe(urls.length);
  });
});

describe("downloadImage", () => {
  const URL = "https://images.example/hero.jpg";
  interface Progress {
    totalBytesExpectedToWrite: number;
    totalBytesWritten: number;
  }

  /**
   * Fake transfer: `progress` events fire during downloadAsync, then it
   * resolves with `status` / `headers`; the saved file reports `savedSize`.
   */
  function setup(opts: {
    headers?: Record<string, string>;
    progress?: Progress[];
    savedSize?: number;
    status?: number;
  }) {
    let fileExists = false;
    (getInfoAsync as jest.Mock).mockImplementation((uri: string) => {
      if (uri.endsWith("article_images/")) {
        return Promise.resolve({ exists: true });
      }
      return Promise.resolve(
        fileExists
          ? { exists: true, size: opts.savedSize ?? 1000 }
          : { exists: false }
      );
    });
    const cancelAsync = jest.fn(async () => undefined);
    (createDownloadResumable as jest.Mock).mockImplementation(
      (
        _url: string,
        uri: string,
        _o: unknown,
        onProgress: (p: Progress) => void
      ) => ({
        cancelAsync,
        downloadAsync: () => {
          for (const p of opts.progress ?? []) {
            onProgress(p);
          }
          fileExists = true;
          return Promise.resolve({
            headers: opts.headers ?? { "Content-Type": "image/jpeg" },
            status: opts.status ?? 200,
            uri,
          });
        },
      })
    );
    return { cancelAsync };
  }

  beforeEach(() => {
    (deleteAsync as jest.Mock).mockClear();
    (createDownloadResumable as jest.Mock).mockReset();
  });

  test("a 200 image response is cached and its uri returned", async () => {
    setup({});
    await expect(downloadImage(URL)).resolves.toBe(
      `file:///docs/article_images/${imageFilenameForUrl(URL)}`
    );
    expect(deleteAsync).not.toHaveBeenCalled();
  });

  test("a captive-portal HTML page is discarded", async () => {
    setup({ headers: { "content-type": "text/html; charset=utf-8" } });
    await expect(downloadImage(URL)).resolves.toBeNull();
    expect(deleteAsync).toHaveBeenCalledTimes(1);
  });

  test("a non-200 status is discarded", async () => {
    setup({ status: 404 });
    await expect(downloadImage(URL)).resolves.toBeNull();
    expect(deleteAsync).toHaveBeenCalledTimes(1);
  });

  test("an oversized Content-Length cancels the transfer", async () => {
    const { cancelAsync } = setup({
      progress: [
        {
          totalBytesExpectedToWrite: MAX_IMAGE_BYTES + 1,
          totalBytesWritten: 10,
        },
      ],
    });
    await expect(downloadImage(URL)).resolves.toBeNull();
    expect(cancelAsync).toHaveBeenCalledTimes(1);
  });

  test("a body that grows past the cap without a length is cancelled", async () => {
    const { cancelAsync } = setup({
      progress: [
        { totalBytesExpectedToWrite: -1, totalBytesWritten: 100 },
        {
          totalBytesExpectedToWrite: -1,
          totalBytesWritten: MAX_IMAGE_BYTES + 1,
        },
        {
          totalBytesExpectedToWrite: -1,
          totalBytesWritten: MAX_IMAGE_BYTES + 2,
        },
      ],
    });
    await expect(downloadImage(URL)).resolves.toBeNull();
    expect(cancelAsync).toHaveBeenCalledTimes(1);
  });

  test("a saved file larger than the cap is deleted", async () => {
    setup({ savedSize: MAX_IMAGE_BYTES + 1 });
    await expect(downloadImage(URL)).resolves.toBeNull();
    expect(deleteAsync).toHaveBeenCalledTimes(1);
  });
});
