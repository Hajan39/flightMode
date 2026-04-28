import bundledContent from "@/data/content.json";
import { useContentStore } from "@/store/useContentStore";
import type { ContentItem } from "@/types/content";

const bundledItems = bundledContent as ContentItem[];

export function useContentItems() {
	return useContentStore((state) => state.items) ?? bundledItems;
}

export function getBundledContentItems() {
	return bundledItems;
}
