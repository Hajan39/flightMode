import type { ContentItem } from "@/types/content";

/**
 * FlightMode Plus article gating (pure). Only articles that explicitly set
 * `plus: true` are Plus — every other article (bundled or from the remote
 * feed) is free, so nothing that is free today can become gated by accident.
 */

const HEADING_RE = /^\*\*(.+)\*\*$/;

export function isPlusContent(item: Pick<ContentItem, "plus">): boolean {
  return item.plus === true;
}

/** Free articles always; Plus articles only with the Plus entitlement. */
export function canReadFullArticle(
  item: Pick<ContentItem, "plus">,
  plus: boolean
): boolean {
  return !isPlusContent(item) || plus;
}

/** Non-empty, trimmed paragraphs of an article body. */
export function splitArticleParagraphs(body: string): string[] {
  return body
    .split("\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Preview of a locked article: everything up to and including the first
 * plain (non-heading, non-bullet) paragraph — the intro.
 */
export function getArticlePreview(paragraphs: readonly string[]): string[] {
  const index = paragraphs.findIndex(
    (p) => !(HEADING_RE.test(p) || p.startsWith("- "))
  );
  if (index < 0) {
    return paragraphs.slice(0, 1);
  }
  return paragraphs.slice(0, index + 1);
}

/** Paragraphs the reader may see right now. */
export function getVisibleParagraphs(
  item: Pick<ContentItem, "plus">,
  body: string,
  plus: boolean
): string[] {
  const paragraphs = splitArticleParagraphs(body);
  return canReadFullArticle(item, plus)
    ? paragraphs
    : getArticlePreview(paragraphs);
}
