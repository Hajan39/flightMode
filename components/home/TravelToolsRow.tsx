import { Ionicons } from "@expo/vector-icons";
import { StyleSheet } from "react-native";

import AnimatedPressable from "@/components/AnimatedPressable";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import type { Destination } from "@/data/destinations";
import { getPhraseLanguage } from "@/data/phrases";
import { useTranslation } from "@/hooks/useTranslation";

type Props = {
	destination: Destination | undefined;
	onOpenPhrasebook: (href: string) => void;
	onOpenConverter: (href: string) => void;
};

/** Two half-width tiles: phrasebook + converter, deep-linked to the destination. */
export default function TravelToolsRow({
	destination,
	onOpenPhrasebook,
	onOpenConverter,
}: Props) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();

	const hasLocalLanguage = Boolean(destination && destination.phraseLanguage !== "en");
	const phrasebookHref = hasLocalLanguage
		? `/phrasebook?lang=${destination?.phraseLanguage}&source=home`
		: "/phrasebook?source=home";
	const converterHref = destination
		? `/converter?currency=${destination.currencyCode}&source=home`
		: "/converter?source=home";

	return (
		<View style={styles.row}>
			<AnimatedPressable
				style={[
					styles.tile,
					{ backgroundColor: theme.card, borderColor: theme.border },
				]}
				onPress={() => onOpenPhrasebook(phrasebookHref)}
			>
				<Ionicons name="chatbubbles-outline" size={24} color={theme.tint} />
				<Text style={styles.label}>{t("homePhrasebook")}</Text>
				<Text style={[styles.sub, { color: theme.mutedText }]}>
					{hasLocalLanguage
						? getPhraseLanguage(destination?.phraseLanguage)?.nativeName
						: t("homeToolsPhrasebookHint")}
				</Text>
			</AnimatedPressable>
			<AnimatedPressable
				style={[
					styles.tile,
					{ backgroundColor: theme.card, borderColor: theme.border },
				]}
				onPress={() => onOpenConverter(converterHref)}
			>
				<Ionicons name="swap-horizontal-outline" size={24} color={theme.tint} />
				<Text style={styles.label}>{t("homeConverter")}</Text>
				<Text style={[styles.sub, { color: theme.mutedText }]}>
					{destination ? destination.currencyCode : t("homeToolsConverterHint")}
				</Text>
			</AnimatedPressable>
		</View>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", gap: 12 },
	tile: {
		flex: 1,
		alignItems: "center",
		padding: 20,
		borderRadius: 16,
		borderWidth: 1,
	},
	label: { fontSize: 14, fontWeight: "600", marginTop: 8 },
	sub: { fontSize: 12, marginTop: 2, textAlign: "center" },
});
