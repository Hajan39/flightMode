import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import { destinations } from "@/data/destinations";
import { useTranslation } from "@/hooks/useTranslation";

export default function DestinationsScreen() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const [expandedId, setExpandedId] = useState<string | null>(
		destinations[0]?.id ?? null,
	);

	const toggle = (id: string) => {
		setExpandedId((current) => (current === id ? null : id));
	};

	return (
		<SafeAreaView
			style={[styles.safe, { backgroundColor: theme.background }]}
			edges={["bottom"]}
		>
			<ScrollView
				style={styles.scroll}
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
			>
				<Text style={[styles.subtitle, { color: theme.mutedText }]}>
					{t("destinationsSubtitle")}
				</Text>

				{destinations.map((destination) => {
					const isExpanded = expandedId === destination.id;
					const tipCount = destination.tips.length;
					const tipLabel = t("destinationsTips");

					return (
						<View
							key={destination.id}
							style={[
								styles.card,
								{ backgroundColor: theme.card, borderColor: theme.border },
							]}
						>
							<Pressable
								style={styles.cardHeader}
								onPress={() => toggle(destination.id)}
								accessibilityRole="button"
								accessibilityState={{ expanded: isExpanded }}
							>
								<Text style={styles.emoji}>{destination.emoji}</Text>
								<View
									style={styles.headerText}
									lightColor="transparent"
									darkColor="transparent"
									crazyColor="transparent"
								>
									<Text style={styles.city}>{destination.city}</Text>
									<Text style={[styles.country, { color: theme.mutedText }]}>
										{destination.country}
									</Text>
								</View>
								<Text style={[styles.tipCount, { color: theme.tint }]}>
									{tipCount} {tipLabel}
								</Text>
								<Ionicons
									name={isExpanded ? "chevron-up" : "chevron-down"}
									size={20}
									color={theme.mutedText}
								/>
							</Pressable>

							{isExpanded && (
								<View
									style={[styles.tips, { borderTopColor: theme.border }]}
									lightColor="transparent"
									darkColor="transparent"
									crazyColor="transparent"
								>
									{destination.tips.map((tip, index) => (
										<View
											key={`${destination.id}-${tip.label}`}
											style={[
												styles.tipRow,
												index === 0 && styles.tipRowFirst,
											]}
											lightColor="transparent"
											darkColor="transparent"
											crazyColor="transparent"
										>
											<View
												style={[
													styles.tipIcon,
													{ backgroundColor: theme.accentSoft },
												]}
												lightColor={theme.accentSoft}
												darkColor={theme.accentSoft}
												crazyColor={theme.accentSoft}
											>
												<Ionicons
													name={tip.icon as keyof typeof Ionicons.glyphMap}
													size={18}
													color={theme.tint}
												/>
											</View>
											<View
												style={styles.tipText}
												lightColor="transparent"
												darkColor="transparent"
												crazyColor="transparent"
											>
												<Text style={[styles.tipLabel, { color: theme.text }]}>
													{tip.label}
												</Text>
												<Text
													style={[styles.tipBody, { color: theme.mutedText }]}
												>
													{tip.text}
												</Text>
											</View>
										</View>
									))}
								</View>
							)}
						</View>
					);
				})}

				{destinations.length === 0 && (
					<View style={styles.empty}>
						<Ionicons
							name="airplane-outline"
							size={48}
							color={theme.mutedText}
						/>
						<Text style={[styles.emptyText, { color: theme.mutedText }]}>
							{t("destinationsEmpty")}
						</Text>
					</View>
				)}
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	scroll: { flex: 1 },
	content: {
		padding: Spacing.lg,
		paddingBottom: Spacing["4xl"],
	},
	subtitle: {
		fontSize: FontSize.sm,
		lineHeight: 18,
		marginBottom: Spacing.lg,
	},
	card: {
		borderWidth: 1,
		borderRadius: Radius.panel,
		marginBottom: Spacing.md,
		overflow: "hidden",
	},
	cardHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.md,
		padding: Spacing.lg,
	},
	emoji: {
		fontSize: FontSize["2xl"],
	},
	headerText: { flex: 1 },
	city: {
		fontSize: FontSize.lg,
		fontWeight: FontWeight.bold,
	},
	country: {
		fontSize: FontSize.sm,
		marginTop: 2,
	},
	tipCount: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.bold,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	tips: {
		borderTopWidth: 1,
		paddingHorizontal: Spacing.lg,
		paddingBottom: Spacing.sm,
	},
	tipRow: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: Spacing.md,
		paddingVertical: Spacing.md,
	},
	tipRowFirst: {
		paddingTop: Spacing.lg,
	},
	tipIcon: {
		width: 34,
		height: 34,
		borderRadius: Radius.sm,
		alignItems: "center",
		justifyContent: "center",
	},
	tipText: { flex: 1 },
	tipLabel: {
		fontSize: FontSize.base,
		fontWeight: FontWeight.semibold,
		marginBottom: 2,
	},
	tipBody: {
		fontSize: FontSize.sm,
		lineHeight: 19,
	},
	empty: {
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.md,
		paddingTop: Spacing["4xl"],
	},
	emptyText: {
		fontSize: FontSize.md,
		fontWeight: FontWeight.semibold,
	},
});
