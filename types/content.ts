import type { LocalizedText } from "@/i18n/translations";

export interface ContentItem {
  body: LocalizedText;
  category: LocalizedText;
  id: string;
  image?: string; // remote CDN URL, downloaded to local cache when on WiFi
  readTime: number; // minutes
  title: LocalizedText;
}
