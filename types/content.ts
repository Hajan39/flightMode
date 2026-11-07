import type { LocalizedText } from "@/i18n/translations";

/** A reference shown under an article (plain text, never fetched). */
export interface ContentSource {
  title: string;
  url: string;
}

export interface ContentItem {
  body: LocalizedText;
  category: LocalizedText;
  id: string;
  image?: string; // remote CDN URL, downloaded to local cache when on WiFi
  /**
   * FlightMode Plus article: without Plus only the intro is shown. Absent
   * (the default, and every remote feed item that does not set it) = free.
   */
  plus?: boolean;
  readTime: number; // minutes
  /** Optional references listed at the end of the article. */
  sources?: ContentSource[];
  title: LocalizedText;
}
