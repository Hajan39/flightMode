import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";

import AnimatedPressable from "@/components/AnimatedPressable";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Shadow, Spacing } from "@/constants/Spacing";
import type { Destination } from "@/data/destinations";
import { getPhraseLanguage } from "@/data/phrases";
import { useTranslation } from "@/hooks/useTranslation";
import { formatTimeInZone } from "@/utils/timezone";

type Props = {
	destination: Destination;
	nowMs: number;
	onOpenPhrasebook: () => void;
	onOpenConverter: () => void;
	onOpenTips: () => void;
	onClear: () => void;
};

/**
 * Shown on Home for 48 h after landing: local time, the two arrival tips that
 * matter first, and one-tap access to the phrasebook, converter and full tips.
 */
export default function LandedCard({
	destination,
	nowMs,
	onOpenPhrasebook,
	onOpenConverter,
	onOpenTips,
	onClear,
}: Props) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();

	const localTime = formatTimeInZone(nowMs, destination);
	const phraseLanguage = getPhraseLanguage(destination.phraseLanguage);
	const hasLocalLanguage = destination.phraseLanguage !== "en";
	// The two tips a fresh arrival needs first.
	const arrivalTips = destination.tips.filter(
		(tip) =>
			tip.labelKey === "destTipFromAirport" ||
			tip.labelKey === "destTipGettingAround",
	);

	return (
		<View
			style={[
				styles.card,
				{ backgroundColor: theme.accentSoft, borderColor: theme.tint },
				Shadow.card,
			]}
		>
			<View style={styles.header} lightColor="transparent" darkColor="transparent">
				<Text style={styles.emoji}>{destination.emoji}</Text>
				<View style={styles.headerText} lightColor="transparent" darkColor="transparent">
					<Text style={styles.title}>
						{t("homeLandedTitle", { city: destination.city })}
					</Text>
					<Text style={[styles.clock, { color: theme.mutedText }]}>
						{t("homeLandedLocalTime", { time: localTime })}
					</Text>
				</View>
				<Pressable
					onPress={onClear}
					hitSlop={10}
					accessibilityRole="button"
					accessibilityLabel={t("a11yClearFlight")}
				>
					<Ionicons name="close-circle-outline" size={20} color={theme.mutedText} />
				</Pressable>
			</View>

			<View style={styles.actions} lightColor="transparent" darkColor="transparent">
				{hasLocalLanguage ? (
					<AnimatedPressable
						style={[styles.action, { backgroundColor: theme.card, borderColor: theme.border }]}
						onPress={onOpenPhrasebook}
					>
						<Ionicons name="chatbubbles-outline" size={20} color={theme.tint} />
						<Text style={styles.actionLabel} numberOfLines={1}>
							{phraseLanguage?.nativeName ?? t("homePhrasebook")}
						</Text>
					</AnimatedPressable>
				) : null}
				<AnimatedPressable
					style={[styles.action, { backgroundColor: theme.card, borderColor: theme.border }]}
					onPress={onOpenConverter}
				>
					<Ionicons name="swap-horizontal-outline" size={20} color={theme.tint} />
					<Text style={styles.actionLabel} numberOfLines={1}>
						{destination.currencyCode}
					</Text>
				</AnimatedPressable>
				<AnimatedPressable
					style={[styles.action, { backgroundColor: theme.card, borderColor: theme.border }]}
					onPress={onOpenTips}
				>
					<Ionicons name="compass-outline" size={20} color={theme.tint} />
					<Text style={styles.actionLabel} numberOfLines={1}>
						{t("homeLandedTips")}
					</Text>
				</AnimatedPressable>
			</View>

			{arrivalTips.map((tip) => (
				<View
					key={tip.labelKey}
					style={styles.tip}
					lightColor="transparent"
					darkColor="transparent"
				>
					<Ionicons
						name={tip.icon as keyof typeof Ionicons.glyphMap}
						size={16}
						color={theme.tint}
					/>
					<View style={styles.tipBody} lightColor="transparent" darkColor="transparent">
						<Text style={[styles.tipLabel, { color: theme.text }]}>
							{t(tip.labelKey)}
						</Text>
						<Text style={[styles.tipText, { color: theme.mutedText }]}>
							{tip.text}
						</Text>
					</View>
				</View>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		borderWidth: 1.5,
		borderRadius: Radius.xl,
		padding: Spacing.xl,
		gap: Spacing.md,
		marginBottom: 6,
	},
	header: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
	emoji: { fontSize: 32 },
	headerText: { flex: 1 },
	title: { fontSize: 18, fontWeight: "700" },
	clock: { fontSize: 13, marginTop: 2 },
	actions: { flexDirection: "row", gap: Spacing.sm },
	action: {
		flex: 1,
		alignItems: "center",
		gap: 4,
		borderWidth: 1,
		borderRadius: Radius.card,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.sm,
	},
	actionLabel: { fontSize: 12, fontWeight: "600" },
	tip: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
	tipBody: { flex: 1 },
	tipLabel: { fontSize: 13, fontWeight: "700" },
	tipText: { fontSize: 13, lineHeight: 18, marginTop: 2 },
});
