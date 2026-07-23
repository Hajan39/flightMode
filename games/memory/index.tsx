import GameResult from "@/components/GameResult";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useAnimatedPress } from "@/hooks/useAnimatedPress";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";
import { useEffect, useRef, useState } from "react";
import {
	FlatList,
	Pressable,
	StyleSheet,
	useWindowDimensions,
} from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withTiming,
} from "react-native-reanimated";
import { type Card, calculateScore, checkMatch, createDeck } from "./logic";

type Theme = (typeof Colors)[keyof typeof Colors];

function FlipCard({
	item,
	cardSize,
	theme,
	onPress,
}: {
	item: Card;
	cardSize: number;
	theme: Theme;
	onPress: (id: number) => void;
}) {
	const rotateY = useSharedValue(0);
	const scale = useSharedValue(1);
	const isShowing = item.isFlipped || item.isMatched;
	const wasShowingRef = useRef(false);
	const wasMatchedRef = useRef(item.isMatched);

	useEffect(() => {
		if (isShowing === wasShowingRef.current) return;
		wasShowingRef.current = isShowing;
		rotateY.value = withSequence(
			withTiming(isShowing ? 90 : -90, {
				duration: 130,
				easing: Easing.in(Easing.quad),
			}),
			withTiming(0, { duration: 130, easing: Easing.out(Easing.quad) }),
		);
	}, [isShowing, rotateY]);

	useEffect(() => {
		if (item.isMatched === wasMatchedRef.current) return;
		wasMatchedRef.current = item.isMatched;
		if (!item.isMatched) return;
		// Small celebratory pulse when the pair is matched
		scale.value = withSequence(
			withTiming(1.1, { duration: 110, easing: Easing.out(Easing.quad) }),
			withTiming(1, { duration: 130, easing: Easing.in(Easing.quad) }),
		);
	}, [item.isMatched, scale]);

	const animStyle = useAnimatedStyle(() => ({
		transform: [{ rotateY: `${rotateY.value}deg` }, { scale: scale.value }],
	}));

	const bgColor = item.isMatched
		? theme.successSurface
		: isShowing
			? theme.elevated
			: theme.tint;

	const borderProps = item.isMatched
		? { borderColor: theme.successBorder, borderWidth: 2 }
		: isShowing
			? { borderColor: theme.tint, borderWidth: 2 }
			: {};

	return (
		<Pressable onPress={() => onPress(item.id)}>
			<Animated.View
				style={[
					styles.card,
					{ width: cardSize, height: cardSize, backgroundColor: bgColor },
					borderProps,
					animStyle,
				]}
			>
				<Text style={styles.cardText}>{isShowing ? item.emoji : "?"}</Text>
			</Animated.View>
		</Pressable>
	);
}

const MEMORY_MODES = [
	{ key: "quick", labelKey: "memoryModeQuick", pairs: 6, columns: 3 },
	{ key: "standard", labelKey: "memoryModeStandard", pairs: 8, columns: 4 },
	{ key: "long", labelKey: "memoryModeLongHaul", pairs: 10, columns: 4 },
] as const;

export default function MemoryGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const { width } = useWindowDimensions();
	const [modeKey, setModeKey] =
		useState<(typeof MEMORY_MODES)[number]["key"]>("standard");
	const currentMode =
		MEMORY_MODES.find((mode) => mode.key === modeKey) ?? MEMORY_MODES[1];
	const [cards, setCards] = useState<Card[]>(() =>
		createDeck(currentMode.pairs),
	);
	const [selected, setSelected] = useState<number[]>([]);
	const [moves, setMoves] = useState(0);
	const [matchedPairs, setMatchedPairs] = useState(0);
	const [isChecking, setIsChecking] = useState(false);
	const [finalScore, setFinalScore] = useState<number | null>(null);
	const [progressInfo, setProgressInfo] = useState<GameProgressUpdate | null>(
		null,
	);
	const updateProgress = useGameStore((s) => s.updateProgress);
	const storedBest = useGameStore((s) => s.progress["memory"]?.highScore ?? 0);
	const haptic = useHaptic();
	const resetPress = useAnimatedPress();
	const flipBackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (flipBackTimer.current) clearTimeout(flipBackTimer.current);
		};
	}, []);
	const cardSize = (() => {
		const horizontalPadding = 40;
		const gap = 10;
		const availableWidth = width - horizontalPadding;
		return Math.floor(
			(availableWidth - gap * (currentMode.columns - 1)) / currentMode.columns,
		);
	})();

	const handleCardPress = (id: number) => {
		if (isChecking) return;

		const card = cards.find((c) => c.id === id);
		if (!card || card.isFlipped || card.isMatched) return;

		const newCards = cards.map((c) =>
			c.id === id ? { ...c, isFlipped: true } : c,
		);
		setCards(newCards);

		const newSelected = [...selected, id];
		setSelected(newSelected);

		if (newSelected.length === 2) {
			setIsChecking(true);
			const newMoves = moves + 1;
			setMoves(newMoves);

			if (checkMatch(newCards, newSelected[0], newSelected[1])) {
				haptic.success();
				const matched = newCards.map((c) =>
					c.id === newSelected[0] || c.id === newSelected[1]
						? { ...c, isMatched: true }
						: c,
				);
				setCards(matched);
				setSelected([]);
				setIsChecking(false);

				const newMatchedCount = matchedPairs + 1;
				setMatchedPairs(newMatchedCount);

				if (newMatchedCount === currentMode.pairs) {
					haptic.heavy();
					const score = calculateScore(newMoves, currentMode.pairs);
					const info = updateProgress("memory", score);
					setProgressInfo(info);
					setFinalScore(score);
				}
			} else {
				flipBackTimer.current = setTimeout(() => {
					setCards((prev) =>
						prev.map((c) =>
							c.id === newSelected[0] || c.id === newSelected[1]
								? { ...c, isFlipped: false }
								: c,
						),
					);
					setSelected([]);
					setIsChecking(false);
				}, 800);
			}
		}
	};

	const changeMode = (nextModeKey: (typeof MEMORY_MODES)[number]["key"]) => {
		const nextMode = MEMORY_MODES.find((mode) => mode.key === nextModeKey);
		if (!nextMode) return;
		if (flipBackTimer.current) clearTimeout(flipBackTimer.current);
		setModeKey(nextModeKey);
		setCards(createDeck(nextMode.pairs));
		setSelected([]);
		setMoves(0);
		setMatchedPairs(0);
		setIsChecking(false);
	};

	const resetGame = () => {
		if (flipBackTimer.current) clearTimeout(flipBackTimer.current);
		setCards(createDeck(currentMode.pairs));
		setSelected([]);
		setMoves(0);
		setMatchedPairs(0);
		setIsChecking(false);
		setFinalScore(null);
		setProgressInfo(null);
	};

	return (
		<View style={styles.root}>
			{/* ── Stats ── */}
			<View style={styles.statsRow}>
				<View style={styles.statBlock}>
					<Text style={[styles.statLabel, { color: theme.mutedText }]}>
						{t("memoryMoves")}
					</Text>
					<Text style={[styles.statValue, { color: theme.text }]}>{moves}</Text>
				</View>
				<View style={[styles.statDivider, { backgroundColor: theme.border }]} />
				<View style={styles.statBlock}>
					<Text style={[styles.statLabel, { color: theme.mutedText }]}>
						{t("memoryPairs")}
					</Text>
					<Text style={[styles.statValue, { color: theme.tint }]}>
						{matchedPairs}
						<Text style={[styles.statTotal, { color: theme.mutedText }]}>
							/{currentMode.pairs}
						</Text>
					</Text>
				</View>
			</View>

			<View style={styles.modeRow}>
				{MEMORY_MODES.map((mode) => {
					const isActive = mode.key === currentMode.key;
					return (
						<Pressable
							key={mode.key}
							style={[
								styles.modeChip,
								{
									backgroundColor: isActive ? theme.tint : theme.card,
									borderColor: isActive ? theme.tint : theme.border,
								},
							]}
							onPress={() => changeMode(mode.key)}
							accessibilityRole="button"
							accessibilityLabel={t(mode.labelKey)}
							accessibilityState={{ selected: isActive }}
						>
							<Text
								style={[
									styles.modeChipText,
									{ color: isActive ? theme.onTint : theme.mutedText },
								]}
							>
								{t(mode.labelKey)}
							</Text>
						</Pressable>
					);
				})}
			</View>

			{/* ── Grid ── */}
			<FlatList
				key={currentMode.key}
				data={cards}
				numColumns={currentMode.columns}
				keyExtractor={(item) => String(item.id)}
				contentContainerStyle={styles.grid}
				columnWrapperStyle={styles.row}
				scrollEnabled={currentMode.pairs >= 10}
				renderItem={({ item }) => (
					<FlipCard
						item={item}
						cardSize={cardSize}
						theme={theme}
						onPress={handleCardPress}
					/>
				)}
			/>

			{/* ── New game ── */}
			<Animated.View style={resetPress.animatedStyle}>
				<Pressable
					style={[
						styles.resetBtn,
						{ backgroundColor: theme.card, borderColor: theme.border },
					]}
					onPressIn={resetPress.onPressIn}
					onPressOut={resetPress.onPressOut}
					onPress={resetGame}
					accessibilityRole="button"
					accessibilityLabel={t("newGame")}
				>
					<Text style={[styles.resetText, { color: theme.text }]}>
						{t("newGame")}
					</Text>
				</Pressable>
			</Animated.View>

			{finalScore !== null && (
				<GameResult
					title={t("youWin")}
					score={finalScore}
					best={progressInfo?.best ?? storedBest}
					last={progressInfo?.previousBest}
					streak={progressInfo?.currentStreak}
					isNewBest={progressInfo?.isNewBest}
					subtitle={t("youWinMessage", { moves, score: finalScore })}
					onPlayAgain={resetGame}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, padding: 20, gap: 16 },
	/* ── Stats ── */
	statsRow: { flexDirection: "row", alignItems: "center" },
	statBlock: { flex: 1, alignItems: "center", gap: 2 },
	statLabel: {
		fontSize: 11,
		fontWeight: "800",
		letterSpacing: 1,
		textTransform: "uppercase",
	},
	statValue: { fontSize: 36, fontWeight: "900", letterSpacing: -1 },
	statTotal: { fontSize: 20, fontWeight: "700" },
	statDivider: { width: 1, height: 50 },
	/* ── Grid ── */
	grid: { alignItems: "center" },
	row: { gap: 10, marginBottom: 10 },
	modeRow: {
		flexDirection: "row",
		gap: 8,
		justifyContent: "center",
		flexWrap: "wrap",
	},
	modeChip: {
		borderWidth: 1,
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 8,
	},
	modeChipText: {
		fontSize: 12,
		fontWeight: "800",
	},
	card: {
		borderRadius: 16,
		alignItems: "center",
		justifyContent: "center",
	},
	cardText: { fontSize: 34 },
	/* ── Reset ── */
	resetBtn: {
		borderWidth: 1.5,
		borderRadius: 14,
		paddingVertical: 14,
		alignItems: "center",
	},
	resetText: { fontSize: 15, fontWeight: "700" },
});
