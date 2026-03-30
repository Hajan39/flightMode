import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useGameStore } from "@/store/useGameStore";

type QuizQuestion = {
	question: string;
	options: string[];
	answer: string;
};

const QUESTIONS: QuizQuestion[] = [
	{
		question:
			"When should you usually arrive at the airport for an international flight?",
		options: ["30 minutes", "1 hour", "2-3 hours", "Just before boarding"],
		answer: "2-3 hours",
	},
	{
		question: "What helps reduce jet lag after landing?",
		options: [
			"Strong coffee only",
			"Morning sunlight",
			"Skipping meals",
			"Sleeping all day",
		],
		answer: "Morning sunlight",
	},
	{
		question: "Which item is best to keep in your personal bag?",
		options: [
			"Heavy shoes",
			"All souvenirs",
			"Passport and charger",
			"Checked-bag lock",
		],
		answer: "Passport and charger",
	},
	{
		question: "What is the best hydration rule on long flights?",
		options: ["Only soda", "Water regularly", "No drinks", "Only coffee"],
		answer: "Water regularly",
	},
	{
		question:
			"If your connection is tight, what should you do first after landing?",
		options: ["Browse shops", "Find transfer gate", "Take photos", "Call home"],
		answer: "Find transfer gate",
	},
	{
		question: "What is usually safest for valuables during a flight?",
		options: [
			"Put them in checked baggage",
			"Keep them in your personal item",
			"Ask cabin crew to store them",
			"Leave them at the gate",
		],
		answer: "Keep them in your personal item",
	},
	{
		question: "Which action helps reduce in-seat stiffness most?",
		options: [
			"Stay perfectly still",
			"Do light movement every hour",
			"Drink less water",
			"Skip all stretching",
		],
		answer: "Do light movement every hour",
	},
	{
		question: "When should you usually check your gate for updates?",
		options: [
			"Only the night before",
			"After takeoff",
			"Before boarding and after landing",
			"Never",
		],
		answer: "Before boarding and after landing",
	},
	{
		question: "For better sleep on a plane, which is most useful?",
		options: [
			"Very bright screen",
			"Noise reduction",
			"Extra caffeine",
			"Heavy meal at midnight",
		],
		answer: "Noise reduction",
	},
	{
		question: "What is a practical carry-on packing strategy?",
		options: [
			"Random items only",
			"One outfit per bag",
			"Roll clothes and use organizers",
			"Pack all shoes first",
		],
		answer: "Roll clothes and use organizers",
	},
];

export default function QuizGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);

	const [currentIndex, setCurrentIndex] = useState(0);
	const [score, setScore] = useState(0);
	const [selectedOption, setSelectedOption] = useState<string | null>(null);

	const currentQuestion = useMemo(
		() => QUESTIONS[currentIndex],
		[currentIndex],
	);
	const progressFraction = (currentIndex + 1) / QUESTIONS.length;

	const handleAnswer = (choice: string) => {
		if (selectedOption !== null) return;

		setSelectedOption(choice);
		const isCorrect = choice === currentQuestion.answer;
		const nextScore = score + (isCorrect ? 10 : 0);

		setTimeout(() => {
			if (currentIndex >= QUESTIONS.length - 1) {
				updateProgress("quiz", nextScore);
				Alert.alert(
					"Quiz finished",
					`Score: ${nextScore}\nCorrect: ${Math.round(nextScore / 10)}/${QUESTIONS.length}`,
					[
						{
							text: "Play again",
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
					{currentIndex + 1}/{QUESTIONS.length}
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
					const isCorrect = option === currentQuestion.answer;
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
					Correct: {currentQuestion.answer}
				</Text>
			) : null}

			<Text style={[styles.scoreText, { color: theme.mutedText }]}>
				Score: {score}
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
