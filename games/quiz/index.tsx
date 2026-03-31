import { useMemo, useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import GameResult from "@/components/GameResult";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useGameStore } from "@/store/useGameStore";
import { useTranslation } from "@/hooks/useTranslation";
import { useHaptic } from "@/hooks/useHaptic";
import type { TranslationKey } from "@/i18n/translations";

type QuizQuestion = {
	question: string;
	options: string[];
	answerIndex: number;
};

const QUESTION_COUNT = 10;

function getAllQuestions(t: (key: TranslationKey) => string): QuizQuestion[] {
	return [
		{
			question: t("quizQ1"),
			options: [t("quizQ1a"), t("quizQ1b"), t("quizQ1c"), t("quizQ1d")],
			answerIndex: 2,
		},
		{
			question: t("quizQ2"),
			options: [t("quizQ2a"), t("quizQ2b"), t("quizQ2c"), t("quizQ2d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ3"),
			options: [t("quizQ3a"), t("quizQ3b"), t("quizQ3c"), t("quizQ3d")],
			answerIndex: 2,
		},
		{
			question: t("quizQ4"),
			options: [t("quizQ4a"), t("quizQ4b"), t("quizQ4c"), t("quizQ4d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ5"),
			options: [t("quizQ5a"), t("quizQ5b"), t("quizQ5c"), t("quizQ5d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ6"),
			options: [t("quizQ6a"), t("quizQ6b"), t("quizQ6c"), t("quizQ6d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ7"),
			options: [t("quizQ7a"), t("quizQ7b"), t("quizQ7c"), t("quizQ7d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ8"),
			options: [t("quizQ8a"), t("quizQ8b"), t("quizQ8c"), t("quizQ8d")],
			answerIndex: 2,
		},
		{
			question: t("quizQ9"),
			options: [t("quizQ9a"), t("quizQ9b"), t("quizQ9c"), t("quizQ9d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ10"),
			options: [t("quizQ10a"), t("quizQ10b"), t("quizQ10c"), t("quizQ10d")],
			answerIndex: 2,
		},
		{
			question: t("quizQ11"),
			options: [t("quizQ11a"), t("quizQ11b"), t("quizQ11c"), t("quizQ11d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ12"),
			options: [t("quizQ12a"), t("quizQ12b"), t("quizQ12c"), t("quizQ12d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ13"),
			options: [t("quizQ13a"), t("quizQ13b"), t("quizQ13c"), t("quizQ13d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ14"),
			options: [t("quizQ14a"), t("quizQ14b"), t("quizQ14c"), t("quizQ14d")],
			answerIndex: 2,
		},
		{
			question: t("quizQ15"),
			options: [t("quizQ15a"), t("quizQ15b"), t("quizQ15c"), t("quizQ15d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ16"),
			options: [t("quizQ16a"), t("quizQ16b"), t("quizQ16c"), t("quizQ16d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ17"),
			options: [t("quizQ17a"), t("quizQ17b"), t("quizQ17c"), t("quizQ17d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ18"),
			options: [t("quizQ18a"), t("quizQ18b"), t("quizQ18c"), t("quizQ18d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ19"),
			options: [t("quizQ19a"), t("quizQ19b"), t("quizQ19c"), t("quizQ19d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ20"),
			options: [t("quizQ20a"), t("quizQ20b"), t("quizQ20c"), t("quizQ20d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ21"),
			options: [t("quizQ21a"), t("quizQ21b"), t("quizQ21c"), t("quizQ21d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ22"),
			options: [t("quizQ22a"), t("quizQ22b"), t("quizQ22c"), t("quizQ22d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ23"),
			options: [t("quizQ23a"), t("quizQ23b"), t("quizQ23c"), t("quizQ23d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ24"),
			options: [t("quizQ24a"), t("quizQ24b"), t("quizQ24c"), t("quizQ24d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ25"),
			options: [t("quizQ25a"), t("quizQ25b"), t("quizQ25c"), t("quizQ25d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ26"),
			options: [t("quizQ26a"), t("quizQ26b"), t("quizQ26c"), t("quizQ26d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ27"),
			options: [t("quizQ27a"), t("quizQ27b"), t("quizQ27c"), t("quizQ27d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ28"),
			options: [t("quizQ28a"), t("quizQ28b"), t("quizQ28c"), t("quizQ28d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ29"),
			options: [t("quizQ29a"), t("quizQ29b"), t("quizQ29c"), t("quizQ29d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ30"),
			options: [t("quizQ30a"), t("quizQ30b"), t("quizQ30c"), t("quizQ30d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ31"),
			options: [t("quizQ31a"), t("quizQ31b"), t("quizQ31c"), t("quizQ31d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ32"),
			options: [t("quizQ32a"), t("quizQ32b"), t("quizQ32c"), t("quizQ32d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ33"),
			options: [t("quizQ33a"), t("quizQ33b"), t("quizQ33c"), t("quizQ33d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ34"),
			options: [t("quizQ34a"), t("quizQ34b"), t("quizQ34c"), t("quizQ34d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ35"),
			options: [t("quizQ35a"), t("quizQ35b"), t("quizQ35c"), t("quizQ35d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ36"),
			options: [t("quizQ36a"), t("quizQ36b"), t("quizQ36c"), t("quizQ36d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ37"),
			options: [t("quizQ37a"), t("quizQ37b"), t("quizQ37c"), t("quizQ37d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ38"),
			options: [t("quizQ38a"), t("quizQ38b"), t("quizQ38c"), t("quizQ38d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ39"),
			options: [t("quizQ39a"), t("quizQ39b"), t("quizQ39c"), t("quizQ39d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ40"),
			options: [t("quizQ40a"), t("quizQ40b"), t("quizQ40c"), t("quizQ40d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ41"),
			options: [t("quizQ41a"), t("quizQ41b"), t("quizQ41c"), t("quizQ41d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ42"),
			options: [t("quizQ42a"), t("quizQ42b"), t("quizQ42c"), t("quizQ42d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ43"),
			options: [t("quizQ43a"), t("quizQ43b"), t("quizQ43c"), t("quizQ43d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ44"),
			options: [t("quizQ44a"), t("quizQ44b"), t("quizQ44c"), t("quizQ44d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ45"),
			options: [t("quizQ45a"), t("quizQ45b"), t("quizQ45c"), t("quizQ45d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ46"),
			options: [t("quizQ46a"), t("quizQ46b"), t("quizQ46c"), t("quizQ46d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ47"),
			options: [t("quizQ47a"), t("quizQ47b"), t("quizQ47c"), t("quizQ47d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ48"),
			options: [t("quizQ48a"), t("quizQ48b"), t("quizQ48c"), t("quizQ48d")],
			answerIndex: 0,
		},
		{
			question: t("quizQ49"),
			options: [t("quizQ49a"), t("quizQ49b"), t("quizQ49c"), t("quizQ49d")],
			answerIndex: 1,
		},
		{
			question: t("quizQ50"),
			options: [t("quizQ50a"), t("quizQ50b"), t("quizQ50c"), t("quizQ50d")],
			answerIndex: 1,
		},
	];
}

function pickRandom(all: QuizQuestion[], count: number): QuizQuestion[] {
	const shuffled = [...all];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled.slice(0, count);
}

export default function QuizGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const { t } = useTranslation();
	const haptic = useHaptic();

	const [seed, setSeed] = useState(0);
	const questions = useMemo(
		() => pickRandom(getAllQuestions(t), QUESTION_COUNT),
		[t, seed],
	);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [score, setScore] = useState(0);
	const [selectedOption, setSelectedOption] = useState<string | null>(null);
	const [showResult, setShowResult] = useState(false);

	const currentQuestion = useMemo(
		() => questions[currentIndex],
		[currentIndex, questions],
	);
	const progressFraction = (currentIndex + 1) / questions.length;

	const handleAnswer = (choice: string) => {
		if (selectedOption !== null) return;

		setSelectedOption(choice);
		const isCorrect =
			choice === currentQuestion.options[currentQuestion.answerIndex];
		const nextScore = score + (isCorrect ? 10 : 0);
		isCorrect ? haptic.success() : haptic.error();

		setTimeout(() => {
			if (currentIndex >= questions.length - 1) {
				updateProgress("quiz", nextScore);
				setScore(nextScore);
				setShowResult(true);
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

			{showResult && (
				<GameResult
					title={t("quizFinished")}
					score={score}
					subtitle={t("quizResult", {
						score,
						correct: Math.round(score / 10),
						total: questions.length,
					})}
					onPlayAgain={() => {
						setSeed((s) => s + 1);
						setCurrentIndex(0);
						setScore(0);
						setSelectedOption(null);
						setShowResult(false);
					}}
				/>
			)}
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
