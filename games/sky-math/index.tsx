import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useGameStore } from "@/store/useGameStore";
import { useTranslation } from "@/hooks/useTranslation";

type Question = {
	text: string;
	options: number[];
	answer: number;
};

const TOTAL_QUESTIONS = 8;

function randomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createQuestion(): Question {
	const a = randomInt(3, 30);
	const b = randomInt(2, 20);
	const usePlus = Math.random() > 0.45;
	const answer = usePlus ? a + b : a - b;
	const text = usePlus ? `${a} + ${b}` : `${a} − ${b}`;

	const options = new Set<number>([answer]);
	while (options.size < 4) {
		const noise = randomInt(-9, 9);
		options.add(answer + noise);
	}

	return {
		text,
		answer,
		options: Array.from(options).sort(() => Math.random() - 0.5),
	};
}

export default function SkyMathGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const { t } = useTranslation();

	const [index, setIndex] = useState(0);
	const [score, setScore] = useState(0);
	const [question, setQuestion] = useState<Question>(() => createQuestion());
	const [selectedOption, setSelectedOption] = useState<number | null>(null);

	const progressLabel = useMemo(
		() => `${index + 1} / ${TOTAL_QUESTIONS}`,
		[index],
	);
	const progressFraction = (index + 1) / TOTAL_QUESTIONS;

	const handleAnswer = (value: number) => {
		if (selectedOption !== null) return;
		setSelectedOption(value);

		const isCorrect = value === question.answer;
		const nextScore = score + (isCorrect ? 10 : 0);

		setTimeout(() => {
			if (index + 1 >= TOTAL_QUESTIONS) {
				setScore(nextScore);
				updateProgress("sky-math", nextScore);
				Alert.alert(
					t("skyMathFinished"),
					t("skyMathResult", { correct: Math.round(nextScore / 10), total: TOTAL_QUESTIONS, score: nextScore }),
					[
						{
							text: t("skyMathPlayAgain"),
							onPress: () => {
								setIndex(0);
								setScore(0);
								setSelectedOption(null);
								setQuestion(createQuestion());
							},
						},
					],
				);
				return;
			}

			setScore(nextScore);
			setIndex((prev) => prev + 1);
			setSelectedOption(null);
			setQuestion(createQuestion());
		}, 550);
	};

	return (
		<View style={styles.root}>
			{/* ── Progress ── */}
			<View style={styles.progressRow}>
				<View style={[styles.progressTrack, { backgroundColor: theme.card }]}>
					<View
						style={[
							styles.progressFill,
							{ backgroundColor: theme.tint, flex: progressFraction },
						]}
					/>
				</View>
				<Text style={[styles.progressLabel, { color: theme.mutedText }]}>
					{progressLabel}
				</Text>
			</View>

			{/* ── Question card ── */}
			<View
				style={[
					styles.questionCard,
					{ backgroundColor: theme.card, borderColor: theme.border },
				]}
			>
				<Text style={[styles.questionText, { color: theme.text }]}>
					{question.text}
				</Text>
				<Text style={[styles.questionEquals, { color: theme.mutedText }]}>
					=
				</Text>
			</View>

			{/* ── Options ── */}
			<View style={styles.options}>
				{question.options.map((option) => {
					const isSelected = selectedOption === option;
					const isCorrect = option === question.answer;
					const showResult = selectedOption !== null;

					const bg =
						showResult && isCorrect
							? theme.successSurface
							: showResult && isSelected && !isCorrect
								? "#4d1f24"
								: theme.elevated;
					const border =
						showResult && isCorrect
							? theme.successBorder
							: showResult && isSelected && !isCorrect
								? "#cc4b5a"
								: theme.border;

					return (
						<Pressable
							key={option}
							style={[
								styles.optionBtn,
								{ backgroundColor: bg, borderColor: border },
							]}
							onPress={() => handleAnswer(option)}
						>
							<Text style={[styles.optionText, { color: theme.text }]}>
								{option}
							</Text>
						</Pressable>
					);
				})}
			</View>

			{/* ── Score ── */}
			<Text style={[styles.scoreText, { color: theme.mutedText }]}>
				{t("skyMathScore", { score })}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, padding: 20, gap: 16 },
	/* ── Progress ── */
	progressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
	progressTrack: {
		flex: 1,
		height: 6,
		borderRadius: 999,
		flexDirection: "row",
		overflow: "hidden",
	},
	progressFill: { borderRadius: 999 },
	progressLabel: {
		fontSize: 13,
		fontWeight: "700",
		minWidth: 50,
		textAlign: "right",
	},
	/* ── Question ── */
	questionCard: {
		borderWidth: 1,
		borderRadius: 20,
		paddingVertical: 28,
		paddingHorizontal: 20,
		alignItems: "center",
		gap: 4,
	},
	questionText: { fontSize: 44, fontWeight: "900", letterSpacing: -1 },
	questionEquals: { fontSize: 20, fontWeight: "700" },
	/* ── Options ── */
	options: { gap: 10 },
	optionBtn: {
		borderWidth: 1.5,
		borderRadius: 14,
		paddingVertical: 16,
		alignItems: "center",
	},
	optionText: { fontSize: 24, fontWeight: "800" },
	/* ── Score ── */
	scoreText: { fontSize: 14, fontWeight: "600", textAlign: "center" },
});
