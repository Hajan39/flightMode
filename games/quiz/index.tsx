import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useGameStore } from "@/store/useGameStore";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/translations";

type QuizQuestion = {
	question: string;
	options: string[];
	answerIndex: number;
};

const QUESTION_COUNT = 10;

function getQuestions(t: (key: TranslationKey) => string): QuizQuestion[] {
	return [
		{ question: t("quizQ1"), options: [t("quizQ1a"), t("quizQ1b"), t("quizQ1c"), t("quizQ1d")], answerIndex: 2 },
		{ question: t("quizQ2"), options: [t("quizQ2a"), t("quizQ2b"), t("quizQ2c"), t("quizQ2d")], answerIndex: 1 },
		{ question: t("quizQ3"), options: [t("quizQ3a"), t("quizQ3b"), t("quizQ3c"), t("quizQ3d")], answerIndex: 2 },
		{ question: t("quizQ4"), options: [t("quizQ4a"), t("quizQ4b"), t("quizQ4c"), t("quizQ4d")], answerIndex: 1 },
		{ question: t("quizQ5"), options: [t("quizQ5a"), t("quizQ5b"), t("quizQ5c"), t("quizQ5d")], answerIndex: 1 },
		{ question: t("quizQ6"), options: [t("quizQ6a"), t("quizQ6b"), t("quizQ6c"), t("quizQ6d")], answerIndex: 1 },
		{ question: t("quizQ7"), options: [t("quizQ7a"), t("quizQ7b"), t("quizQ7c"), t("quizQ7d")], answerIndex: 1 },
		{ question: t("quizQ8"), options: [t("quizQ8a"), t("quizQ8b"), t("quizQ8c"), t("quizQ8d")], answerIndex: 2 },
		{ question: t("quizQ9"), options: [t("quizQ9a"), t("quizQ9b"), t("quizQ9c"), t("quizQ9d")], answerIndex: 1 },
		{ question: t("quizQ10"), options: [t("quizQ10a"), t("quizQ10b"), t("quizQ10c"), t("quizQ10d")], answerIndex: 2 },
	];
}

export default function QuizGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const { t } = useTranslation();

	const questions = useMemo(() => getQuestions(t), [t]);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [score, setScore] = useState(0);
	const [selectedOption, setSelectedOption] = useState<string | null>(null);

	const currentQuestion = useMemo(
		() => questions[currentIndex],
		[currentIndex, questions],
	);
	const progressFraction = (currentIndex + 1) / questions.length;

	const handleAnswer = (choice: string) => {
		if (selectedOption !== null) return;

		setSelectedOption(choice);
		const isCorrect = choice === currentQuestion.options[currentQuestion.answerIndex];
		const nextScore = score + (isCorrect ? 10 : 0);

		setTimeout(() => {
			if (currentIndex >= questions.length - 1) {
				updateProgress("quiz", nextScore);
				Alert.alert(
					t("quizFinished"),
					t("quizResult", { score: nextScore, correct: Math.round(nextScore / 10), total: questions.length }),
					[
						{
							text: t("quizPlayAgain"),
							onPress: () => {
								setCurrentIndex(0);
								setScore(0);
								setSelectedOption(null);
							},
						},
					],
				);
				return;
			}

			setScore(nextScore);
			setSelectedOption(null);
			setCurrentIndex((prev) => prev + 1);
		}, 750);
	};

	const correctAnswer = currentQuestion.options[currentQuestion.answerIndex];

	return (
		<View style={styles.root}>
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
					{currentIndex + 1}/{questions.length}
				</Text>
			</View>

			<View
				style={[
					styles.questionCard,
					{ backgroundColor: theme.card, borderColor: theme.border },
				]}
			>
				<Text style={[styles.questionText, { color: theme.text }]}>
					{currentQuestion.question}
				</Text>
			</View>

			<View style={styles.options}>
				{currentQuestion.options.map((option) => {
					const isSelected = selectedOption === option;
					const isCorrect = option === correctAnswer;
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

			{selectedOption !== null ? (
				<Text style={[styles.answerHint, { color: theme.mutedText }]}>
					{t("quizCorrectAnswer", { answer: correctAnswer })}
				</Text>
			) : null}

			<Text style={[styles.scoreText, { color: theme.mutedText }]}>
				{t("quizScore", { score })}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, padding: 20, gap: 14 },
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
	questionCard: { borderWidth: 1, borderRadius: 18, padding: 20 },
	questionText: { fontSize: 18, fontWeight: "700", lineHeight: 27 },
	options: { gap: 10 },
	optionBtn: {
		borderWidth: 1.5,
		borderRadius: 14,
		paddingVertical: 14,
		paddingHorizontal: 16,
	},
	optionText: { fontSize: 16, fontWeight: "600" },
	answerHint: { fontSize: 13, fontWeight: "600" },
	scoreText: { fontSize: 14, fontWeight: "600", textAlign: "center" },
});
