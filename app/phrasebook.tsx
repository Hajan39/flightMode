import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import {
	getPhraseLanguage,
	type PhraseLanguageCode,
	phraseIds,
	phraseLanguageList,
	phraseMeaningKeys,
} from "@/data/phrases";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useAchievementStore } from "@/store/useAchievementStore";
import { captureAnalyticsEvent } from "@/utils/analytics";

export default function PhrasebookScreen() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const haptic = useHaptic();
	const { lang, source } = useLocalSearchParams<{
		lang?: string;
		source?: string;
	}>();
	const markPhraseLanguageViewed = useAchievementStore(
		(s) => s.markPhraseLanguageViewed,
	);
	const initial: PhraseLanguageCode = getPhraseLanguage(lang)?.code ?? "es";
	const [active, setActive] = useState<PhraseLanguageCode>(initial);
	const language = getPhraseLanguage(active) ?? phraseLanguageList[0];

	useEffect(() => {
		captureAnalyticsEvent("phrasebook_open", {
			source: source ?? "direct",
			language: initial,
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		markPhraseLanguageViewed(active);
	}, [active, markPhraseLanguageViewed]);

	const selectLanguage = (code: PhraseLanguageCode) => {
		if (code === active) return;
		haptic.tap();
		setActive(code);
		captureAnalyticsEvent("phrasebook_language_changed", { language: code });
	};

	return (
		<SafeAreaView
			style={[styles.screen, { backgroundColor: theme.background }]}
			edges={["bottom"]}
		>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				style={styles.chipScroll}
				contentContainerStyle={styles.chipRow}
			>
				{phraseLanguageList.map((item) => {
					const isActive = item.code === active;
					return (
						<Pressable
							key={item.code}
							onPress={() => selectLanguage(item.code)}
							accessibilityRole="button"
							accessibilityState={{ selected: isActive }}
							style={[
								styles.chip,
								{
									borderColor: isActive ? theme.tint : theme.border,
									backgroundColor: isActive ? theme.tint : theme.card,
								},
							]}
						>
							<Text
								style={[
									styles.chipText,
									{ color: isActive ? theme.onTint : theme.text },
								]}
							>
								{item.nativeName}
							</Text>
						</Pressable>
					);
				})}
			</ScrollView>

			<ScrollView
				style={styles.screen}
				contentContainerStyle={styles.container}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.header} lightColor="transparent" darkColor="transparent">
					<Text style={styles.headerTitle}>{language.nativeName}</Text>
					<Text style={[styles.headerSub, { color: theme.mutedText }]}>
						{language.nameEn} · {t("phrasebookSubtitle")}
					</Text>
				</View>

				<View
					style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
				>
					{phraseIds.map((id, index) => {
						const phrase = language.phrases[id];
						return (
							<View
								key={id}
								style={[
									styles.row,
									index > 0 && { borderTopColor: theme.border, borderTopWidth: 1 },
								]}
								lightColor="transparent"
								darkColor="transparent"
								accessibilityLabel={`${t(phraseMeaningKeys[id])}: ${phrase.native}${
									phrase.roman ? `, ${phrase.roman}` : ""
								}`}
							>
								<Text style={[styles.meaning, { color: theme.mutedText }]}>
									{t(phraseMeaningKeys[id])}
								</Text>
								<Text style={styles.native}>{phrase.native}</Text>
								{phrase.roman ? (
									<Text style={[styles.roman, { color: theme.mutedText }]}>
										{phrase.roman}
									</Text>
								) : null}
							</View>
						);
					})}
				</View>

				{language.nonLatin ? (
					<View style={styles.hintRow} lightColor="transparent" darkColor="transparent">
						<Ionicons name="information-circle-outline" size={16} color={theme.mutedText} />
						<Text style={[styles.hint, { color: theme.mutedText }]}>
							{t("phrasebookRomanHint")}
						</Text>
					</View>
				) : null}
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	screen: { flex: 1 },
	chipScroll: { flexGrow: 0 },
	chipRow: {
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.md,
		gap: Spacing.sm,
	},
	chip: {
		borderWidth: 1,
		borderRadius: Radius.pill,
		paddingHorizontal: Spacing.md,
		paddingVertical: 6,
	},
	chipText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
	container: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing["4xl"] },
	header: { marginBottom: Spacing.lg, gap: 2 },
	headerTitle: { fontSize: FontSize["2xl"], fontWeight: FontWeight.bold },
	headerSub: { fontSize: FontSize.sm },
	card: { borderWidth: 1, borderRadius: Radius.panel, paddingHorizontal: Spacing.lg },
	row: { paddingVertical: Spacing.md, gap: 2 },
	meaning: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.bold,
		textTransform: "uppercase",
		letterSpacing: 0.6,
	},
	native: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, lineHeight: 28 },
	roman: { fontSize: FontSize.sm, fontStyle: "italic" },
	hintRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.sm,
		marginTop: Spacing.lg,
	},
	hint: { flex: 1, fontSize: FontSize.sm, lineHeight: 18 },
});
