import type { LocalizedText } from '@/i18n/translations';

export type ContentItem = {
  id: string;
  title: LocalizedText;
  category: LocalizedText;
  readTime: number; // minutes
  body: LocalizedText;
};
