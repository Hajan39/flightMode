import { useState, useEffect, useRef } from "react";
import { StyleSheet, Pressable, ScrollView } from "react-native";
import Animated, {
	FadeInDown,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
	Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "@/components/Themed";
import AnimatedPressable from "@/components/AnimatedPressable";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/translations";
import { useAudioStore } from "@/store/useAudioStore";
import { useAchievementStore } from "@/store/useAchievementStore";

const BREATHING_PHASES = [
	{ key: "breatheIn" as TranslationKey, duration: 4 },
	{ key: "hold" as TranslationKey, duration: 4 },
	{ key: "breatheOut" as TranslationKey, duration: 4 },
	{ key: "hold" as TranslationKey, duration: 4 },
] as const;

type SoundscapeDef = {
	id: string;
	labelKey: TranslationKey;
	icon: string;
	source: number;
};

const SOUNDSCAPES: SoundscapeDef[] = [
	{
		id: "rain",
		labelKey: "soundRain",
		icon: "rainy-outline",
		source: require("@/assets/audio/rain.mp3"),
	},
	{
		id: "whitenoise",
		labelKey: "soundWhiteNoise",
		icon: "radio-outline",
		source: require("@/assets/audio/whitenoise.mp3"),
	},
	{
		id: "ocean",
		labelKey: "soundOcean",
		icon: "water-outline",
		source: require("@/assets/audio/ocean.mp3"),
	},
	{
		id: "cabin",
		labelKey: "soundCabin",
		icon: "airplane-outline",
		source: require("@/assets/audio/cabin.mp3"),
	},
];

export default function RelaxScreen() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();

	// Breathing state
	const [isActive, setIsActive] = useState(false);
	const [phaseIndex, setPhaseIndex] = useState(0);
	const [countdown, setCountdown] = useState<number>(
		BREATHING_PHASES[0].duration,
	);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// Soundscape state
	const activeSoundId = useAudioStore((s) => s.activeSoundId);
	const volume = useAudioStore((s) => s.volume);
	const sleepTimerEndAt = useAudioStore((s) => s.sleepTimerEndAt);
	const sleepTimerPresetMinutes = useAudioStore(
		(s) => s.sleepTimerPresetMinutes,
	);
	const playSound = useAudioStore((s) => s.playSound);
	const stopSound = useAudioStore((s) => s.stopSound);
	const setVolume = useAudioStore((s) => s.setVolume);
	const setSleepTimer = useAudioStore((s) => s.setSleepTimer);
	const [now, setNow] = useState(Date.now());

	// Breathing timer
	useEffect(() => {
		if (!isActive) {
			if (intervalRef.current) clearInterval(intervalRef.current);
			return;
		}

		intervalRef.current = setInterval(() => {
			setCountdown((prev) => {
				if (prev <= 1) {
					setPhaseIndex((pi) => (pi + 1) % BREATHING_PHASES.length);
					return BREATHING_PHASES[(phaseIndex + 1) % BREATHING_PHASES.length]
						.duration;
				}
				return prev - 1;
			});
		}, 1000);

		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, [isActive, phaseIndex]);

	useEffect(() => {
		if (!sleepTimerEndAt) {
			return;
		}

		const tick = setInterval(() => {
			setNow(Date.now());
		}, 1000);

		return () => clearInterval(tick);
	}, [sleepTimerEndAt]);

	const incrementRelax = useAchievementStore((s) => s.incrementRelax);
	const markSoundPlayed = useAchievementStore((s) => s.markSoundPlayed);

	const handleBreathToggle = () => {
		if (isActive) {
			setIsActive(false);
			setPhaseIndex(0);
			setCountdown(BREATHING_PHASES[0].duration);
		} else {
			setIsActive(true);
			incrementRelax();
		}
	};

	const toggleSoundscape = (scape: SoundscapeDef) => {
		playSound(scape.id, scape.labelKey, scape.source);
		markSoundPlayed(scape.id);
	};

	const stopActiveSoundscape = () => {
		stopSound();
	};

	const activeSoundscape = SOUNDSCAPES.find(
		(item) => item.id === activeSoundId,
	);
	const sleepMinutesLeft = sleepTimerEndAt
		? Math.max(0, Math.ceil((sleepTimerEndAt - now) / 60_000))
		: 0;

	const phase = BREATHING_PHASES[phaseIndex];

	// Breathing circle animation
	const breathScale = useSharedValue(1);

	useEffect(() => {
		if (isActive) {
			const dur = phase.duration * 1000;
			// Inhale → grow, hold → stay, exhale → shrink, hold → stay
			if (phase.key === ("breatheIn" as TranslationKey)) {
				breathScale.value = withTiming(1.15, {
					duration: dur,
					easing: Easing.inOut(Easing.ease),
				});
			} else if (phase.key === ("breatheOut" as TranslationKey)) {
				breathScale.value = withTiming(1, {
					duration: dur,
					easing: Easing.inOut(Easing.ease),
				});
			}
		} else {
			breathScale.value = withTiming(1, { duration: 300 });
		}
	}, [isActive, phase.key, phase.duration]);

	const breathCircleStyle = useAnimatedStyle(() => ({
		transform: [{ scale: breathScale.value }],
	}));

	return (
		<ScrollView
			style={[styles.scroll, { backgroundColor: theme.background }]}
			contentContainerStyle={styles.content}
		>
			{/* Breathing section */}
			<Animated.View
				entering={FadeInDown.duration(500).springify()}
				style={styles.breathingSection}
			>
				<Text style={styles.sectionTitle}>{t("breathingExercise")}</Text>
				<Text style={[styles.subtitle, { color: theme.mutedText }]}>
					{t("boxBreathing")}
				</Text>

				<Animated.View
					style={[
						styles.breathCircle,
						{ borderColor: theme.tint, backgroundColor: theme.card },
						breathCircleStyle,
					]}
				>
					<Text style={[styles.phaseLabel, { color: theme.tint }]}>
						{isActive ? t(phase.key) : t("ready")}
					</Text>
					<Text style={[styles.countdown, { color: theme.tint }]}>
						{isActive ? countdown : "—"}
					</Text>
				</Animated.View>

				<AnimatedPressable
					style={[styles.button, { backgroundColor: theme.tint }]}
					onPress={handleBreathToggle}
				>
					<Ionicons
						name={isActive ? "stop-circle-outline" : "play-circle-outline"}
						size={28}
						color="#fff"
					/>
					<Text style={styles.buttonText}>
						{isActive ? t("stop") : t("start")}
					</Text>
				</AnimatedPressable>
			</Animated.View>

			{/* Soundscapes section */}
			<Animated.View
				entering={FadeInDown.delay(200).springify()}
				style={styles.soundscapesSection}
			>
				<Text style={[styles.sectionLabel, { color: theme.mutedText }]}>
					{t("soundscapes").toUpperCase()}
				</Text>
				{activeSoundscape ? (
					<View
						style={[
							styles.nowPlayingBar,
							{ backgroundColor: theme.accentSoft, borderColor: theme.tint },
						]}
					>
						<View
							style={styles.nowPlayingLeft}
							lightColor="transparent"
							darkColor="transparent"
						>
							<Ionicons name="volume-medium" size={16} color={theme.tint} />
							<Text style={[styles.nowPlayingText, { color: theme.text }]}>
								{t(activeSoundscape.labelKey)}
							</Text>
						</View>
						<Pressable
							style={styles.nowPlayingStop}
							onPress={stopActiveSoundscape}
						>
							<Ionicons name="stop-circle" size={22} color={theme.tint} />
						</Pressable>
					</View>
				) : null}
				<View
					style={styles.volumeRow}
					lightColor="transparent"
					darkColor="transparent"
				>
					{[0.3, 0.6, 0.9].map((level) => {
						const isSelected = Math.abs(volume - level) < 0.01;
						return (
							<Pressable
								key={level}
								style={[
									styles.volumeChip,
									{
										backgroundColor: isSelected ? theme.tint : theme.card,
										borderColor: isSelected ? theme.tint : theme.border,
									},
								]}
								onPress={() => setVolume(level)}
							>
								<Text
									style={[
										styles.volumeChipText,
										{ color: isSelected ? "#fff" : theme.mutedText },
									]}
								>
									VOL {Math.round(level * 100)}%
								</Text>
							</Pressable>
						);
					})}
				</View>
				<View
					style={styles.sleepTimerWrap}
					lightColor="transparent"
					darkColor="transparent"
				>
					<Text style={[styles.sectionLabel, { color: theme.mutedText }]}>
						{t("sleepTimer").toUpperCase()}
					</Text>
					{sleepTimerEndAt ? (
						<Text style={[styles.sleepTimerHint, { color: theme.mutedText }]}>
							{t("sleepTimerStopsIn", { minutes: sleepMinutesLeft })}
						</Text>
					) : null}
					<View
						style={styles.sleepTimerRow}
						lightColor="transparent"
						darkColor="transparent"
					>
						{([null, 10, 20, 30] as Array<number | null>).map((minutes) => {
							const isSelected =
								minutes === null
									? sleepTimerEndAt === null
									: sleepTimerPresetMinutes === minutes;

							return (
								<Pressable
									key={minutes === null ? "off" : minutes}
									style={[
										styles.sleepTimerChip,
										{
											backgroundColor: isSelected ? theme.tint : theme.card,
											borderColor: isSelected ? theme.tint : theme.border,
										},
									]}
									onPress={() => setSleepTimer(minutes)}
								>
									<Text
										style={[
											styles.sleepTimerChipText,
											{ color: isSelected ? "#fff" : theme.mutedText },
										]}
									>
										{minutes === null ? t("sleepTimerOff") : `${minutes}m`}
									</Text>
								</Pressable>
							);
						})}
					</View>
				</View>
				<View
					style={styles.soundGrid}
					lightColor="transparent"
					darkColor="transparent"
				>
					{SOUNDSCAPES.map((scape, scapeIndex) => {
						const isActive = activeSoundId === scape.id;
						return (
							<Animated.View
								key={scape.id}
								entering={FadeInDown.delay(300 + scapeIndex * 80).springify()}
							>
								<AnimatedPressable
									style={[
										styles.soundCard,
										{
											backgroundColor: isActive ? theme.accentSoft : theme.card,
											borderColor: isActive ? theme.tint : theme.border,
										},
									]}
									onPress={() => toggleSoundscape(scape)}
								>
									<Ionicons
										name={scape.icon as never}
										size={32}
										color={isActive ? theme.tint : theme.mutedText}
									/>
									<Text
										style={[
											styles.soundLabel,
											{ color: isActive ? theme.tint : theme.text },
										]}
									>
										{t(scape.labelKey)}
									</Text>
									{isActive && (
										<View
											style={[
												styles.playingDot,
												{ backgroundColor: theme.tint },
											]}
											lightColor={theme.tint}
											darkColor={theme.tint}
										/>
									)}
								</AnimatedPressable>
							</Animated.View>
						);
					})}
				</View>
			</Animated.View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	scroll: { flex: 1 },
	content: { padding: 20, paddingBottom: 40 },

	// Breathing
	breathingSection: {
		alignItems: "center",
		paddingVertical: 16,
	},
	sectionTitle: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
	subtitle: { fontSize: 14, marginBottom: 32 },
	breathCircle: {
		width: 190,
		height: 190,
		borderRadius: 95,
		borderWidth: 4,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 32,
	},
	phaseLabel: { fontSize: 18, fontWeight: "600" },
	countdown: { fontSize: 48, fontWeight: "700", marginTop: 4 },
	button: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 32,
		paddingVertical: 14,
		borderRadius: 30,
		gap: 8,
	},
	buttonText: { color: "#fff", fontSize: 18, fontWeight: "600" },

	// Soundscapes
	soundscapesSection: {
		marginTop: 32,
	},
	sectionLabel: {
		fontSize: 12,
		fontWeight: "600",
		letterSpacing: 0.8,
		marginBottom: 12,
		paddingHorizontal: 4,
	},
	nowPlayingBar: {
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 12,
		paddingVertical: 8,
		marginBottom: 12,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	nowPlayingLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	nowPlayingText: {
		fontSize: 13,
		fontWeight: "700",
	},
	nowPlayingStop: {
		paddingLeft: 12,
		paddingVertical: 2,
	},
	volumeRow: {
		flexDirection: "row",
		gap: 8,
		marginBottom: 12,
	},
	volumeChip: {
		borderWidth: 1,
		borderRadius: 10,
		paddingHorizontal: 10,
		paddingVertical: 6,
	},
	volumeChipText: {
		fontSize: 11,
		fontWeight: "700",
	},
	sleepTimerWrap: {
		marginBottom: 14,
	},
	sleepTimerHint: {
		fontSize: 12,
		marginBottom: 8,
		paddingHorizontal: 4,
	},
	sleepTimerRow: {
		flexDirection: "row",
		gap: 8,
	},
	sleepTimerChip: {
		borderWidth: 1,
		borderRadius: 10,
		paddingHorizontal: 10,
		paddingVertical: 6,
	},
	sleepTimerChipText: {
		fontSize: 11,
		fontWeight: "700",
	},
	soundGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 12,
	},
	soundCard: {
		width: "47%",
		borderWidth: 2,
		borderRadius: 16,
		padding: 20,
		alignItems: "center",
		gap: 10,
		position: "relative",
	},
	soundLabel: {
		fontSize: 14,
		fontWeight: "600",
	},
	playingDot: {
		position: "absolute",
		top: 10,
		right: 10,
		width: 8,
		height: 8,
		borderRadius: 4,
	},
});
