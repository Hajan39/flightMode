import { useState } from "react";
import {
	Modal,
	Pressable,
	StyleSheet,
	ScrollView,
	View as RNView,
} from "react-native";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/translations";

type Props = {
	titleKey: TranslationKey;
	rulesKey: TranslationKey;
	inline?: boolean;
};

/**
 * Renders rules text with section headers (lines starting with emoji + bold text)
 * and bullet lines (lines starting with "  • " or "  ‣ ").
 * Regular lines render as normal paragraphs.
 */
function RulesContent({ text, textColor, mutedColor }: { text: string; textColor: string; mutedColor: string }) {
	const lines = text.split("\n");
	return (
		<>
			{lines.map((line, i) => {
				const trimmed = line.trim();
				if (!trimmed) return <RNView key={i} style={styles.spacer} />;

				// Section header — starts with emoji (non-ASCII) and rest is bold
				if (/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2700}-\u{27BF}\u{FE00}-\u{FEFF}\u{1FA00}-\u{1FAFF}]/u.test(trimmed)) {
					return (
						<Text key={i} style={[styles.sectionHeader, { color: textColor }]}>
							{trimmed}
						</Text>
					);
				}

				// Bullet line
				if (trimmed.startsWith("•") || trimmed.startsWith("‣") || trimmed.startsWith("→")) {
					return (
						<RNView key={i} style={styles.bulletRow}>
							<Text style={[styles.bulletChar, { color: mutedColor }]}>
								{trimmed[0]}
							</Text>
							<Text style={[styles.bulletText, { color: textColor }]}>
								{trimmed.slice(1).trim()}
							</Text>
						</RNView>
					);
				}

				// Regular text
				return (
					<Text key={i} style={[styles.rules, { color: textColor }]}>
						{trimmed}
					</Text>
				);
			})}
		</>
	);
}

export default function GameRules({ titleKey, rulesKey, inline }: Props) {
	const [visible, setVisible] = useState(false);
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();

	return (
		<>
			<Pressable
				onPress={() => setVisible(true)}
				style={[
					inline ? styles.helpBtnInline : styles.helpBtn,
					{ backgroundColor: theme.card, borderColor: theme.border },
				]}
				hitSlop={10}
			>
				<Text style={[styles.helpText, { color: theme.tint }]}>?</Text>
			</Pressable>

			<Modal
				visible={visible}
				transparent
				animationType="fade"
				onRequestClose={() => setVisible(false)}
			>
				<Pressable style={styles.overlay} onPress={() => setVisible(false)}>
					<Pressable
						style={[styles.card, { backgroundColor: theme.elevated }]}
						onPress={() => {}}
					>
						<Text style={[styles.title, { color: theme.text }]}>
							{t(titleKey)}
						</Text>
						<ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
							<RulesContent
								text={t(rulesKey)}
								textColor={theme.text}
								mutedColor={theme.mutedText}
							/>
						</ScrollView>
						<Pressable
							onPress={() => setVisible(false)}
							style={[styles.closeBtn, { backgroundColor: theme.tint }]}
						>
							<Text style={styles.closeBtnText}>OK</Text>
						</Pressable>
					</Pressable>
				</Pressable>
			</Modal>
		</>
	);
}

const styles = StyleSheet.create({
	helpBtn: {
		position: "absolute",
		top: 8,
		right: 12,
		width: 32,
		height: 32,
		borderRadius: 16,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 10,
	},
	helpBtnInline: {
		width: 32,
		height: 32,
		borderRadius: 16,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	helpText: { fontSize: 18, fontWeight: "800" },
	overlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.55)",
		alignItems: "center",
		justifyContent: "center",
		padding: 24,
	},
	card: {
		width: "100%",
		maxWidth: 380,
		maxHeight: "75%",
		borderRadius: 16,
		padding: 20,
		alignItems: "center",
	},
	title: { fontSize: 20, fontWeight: "800", marginBottom: 14 },
	scroll: { width: "100%", marginBottom: 16 },
	sectionHeader: { fontSize: 15, fontWeight: "800", marginTop: 10, marginBottom: 4 },
	bulletRow: { flexDirection: "row", paddingLeft: 4, marginBottom: 3 },
	bulletChar: { fontSize: 14, lineHeight: 21, width: 16 },
	bulletText: { fontSize: 14, lineHeight: 21, flex: 1 },
	spacer: { height: 6 },
	rules: { fontSize: 14, lineHeight: 21, marginBottom: 2 },
	closeBtn: {
		paddingHorizontal: 32,
		paddingVertical: 10,
		borderRadius: 10,
	},
	closeBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
