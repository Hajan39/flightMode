jest.mock("expo-file-system/legacy", () => ({
  createDownloadResumable: jest.fn(),
  deleteAsync: jest.fn(async () => undefined),
  documentDirectory: "file:///docs/",
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  makeDirectoryAsync: jest.fn(async () => undefined),
}));

import { createDownloadResumable } from "expo-file-system/legacy";

import {
  downloadImage,
  hashUrl,
  imageFilenameForUrl,
  isAllowedImageUrl,
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
