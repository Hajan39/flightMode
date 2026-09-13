import { Link, Stack } from "expo-router";
import { StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import { useTranslation } from "@/hooks/useTranslation";

export default function NotFoundScreen() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();

	return (
		<>
			<Stack.Screen options={{ title: t("notFoundTitle") }} />
			<View style={styles.container}>
				<Text style={styles.title}>{t("notFoundBody")}</Text>

				<Link href="/" style={styles.link}>
					<Text style={[styles.linkText, { color: theme.tint }]}>
						{t("notFoundGoHome")}
					</Text>
				</Link>
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: Spacing.xl,
	},
	title: {
		fontSize: FontSize.xl,
		fontWeight: FontWeight.bold,
		textAlign: "center",
	},
	link: {
		marginTop: Spacing.lg,
		paddingVertical: Spacing.lg,
	},
	linkText: {
		fontSize: FontSize.base,
		fontWeight: FontWeight.semibold,
	},
});
