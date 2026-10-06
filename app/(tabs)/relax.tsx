import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import AnimatedPressable from "@/components/AnimatedPressable";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useHaptic } from "@/hooks/useHaptic";
import { useTabletLayout } from "@/hooks/useTabletLayout";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/translations";
import { useAchievementStore } from "@/store/useAchievementStore";
import { useAudioStore } from "@/store/useAudioStore";
import { captureAnalyticsEvent } from "@/utils/analytics";
import { trackFirstSessionCompleted } from "@/utils/firstSession";

const BREATHING_PHASES = [
  { duration: 4, key: "breatheIn" as TranslationKey },
  { duration: 4, key: "hold" as TranslationKey },
  { duration: 4, key: "breatheOut" as TranslationKey },
  { duration: 4, key: "hold" as TranslationKey },
] as const;

interface SoundscapeDef {
  icon: string;
  id: string;
  labelKey: TranslationKey;
  source: number;
}

const SOUNDSCAPES: SoundscapeDef[] = [
  {
    icon: "rainy-outline",
    id: "rain",
    labelKey: "soundRain",
    source: require("@/assets/audio/rain.mp3"),
  },
  {
    icon: "radio-outline",
    id: "whitenoise",
    labelKey: "soundWhiteNoise",
    source: require("@/assets/audio/whitenoise.mp3"),
  },
  {
    icon: "water-outline",
    id: "ocean",
    labelKey: "soundOcean",
    source: require("@/assets/audio/ocean.mp3"),
  },
  {
    icon: "airplane-outline",
    id: "cabin",
    labelKey: "soundCabin",
    source: require("@/assets/audio/cabin.mp3"),
  },
];

export default function RelaxScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { capStyle } = useTabletLayout();

  // Breathing state
  const [isActive, setIsActive] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [countdown, setCountdown] = useState<number>(
    BREATHING_PHASES[0].duration
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Soundscape state
  const activeSoundId = useAudioStore((s) => s.activeSoundId);
  const volume = useAudioStore((s) => s.volume);
  const sleepTimerEndAt = useAudioStore((s) => s.sleepTimerEndAt);
  const sleepTimerPresetMinutes = useAudioStore(
    (s) => s.sleepTimerPresetMinutes
  );
  const playSound = useAudioStore((s) => s.playSound);
  const stopSound = useAudioStore((s) => s.stopSound);
  const setVolume = useAudioStore((s) => s.setVolume);
  const setSleepTimer = useAudioStore((s) => s.setSleepTimer);
  const [now, setNow] = useState(Date.now());

  // Breathing timer
  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
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
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
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

  // Haptic pulse on each breathing phase transition
  const phaseStartedRef = useRef(false);
  useEffect(() => {
    if (!isActive) {
      phaseStartedRef.current = false;
      return;
    }
    // biome-ignore lint/suspicious/noUnnecessaryConditions: the ref flips to true below; it skips the pulse on the first phase after activation
    if (!phaseStartedRef.current) {
      phaseStartedRef.current = true;
      return;
    }
    haptic.tap();
    // `haptic` is intentionally omitted: useHaptic() returns a fresh object
    // each render, and the component re-renders every second (countdown), so
    // including it would fire the pulse every second instead of once per phase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, haptic.tap]);

  const handleBreathToggle = () => {
    haptic.tap();
    if (isActive) {
      setIsActive(false);
      setPhaseIndex(0);
      setCountdown(BREATHING_PHASES[0].duration);
      captureAnalyticsEvent("relax_finish", { exercise: "box_breathing" });
      trackFirstSessionCompleted("relax");
    } else {
      setIsActive(true);
      incrementRelax();
      captureAnalyticsEvent("relax_start", { exercise: "box_breathing" });
    }
  };

  const toggleSoundscape = (scape: SoundscapeDef) => {
    haptic.tap();
    const isStoppingActiveSoundscape = activeSoundId === scape.id;
    playSound(scape.id, scape.labelKey, scape.source);
    markSoundPlayed(scape.id);
    captureAnalyticsEvent(
      isStoppingActiveSoundscape ? "audio_stop" : "audio_play",
      { sound_id: scape.id }
    );
  };

  const stopActiveSoundscape = () => {
    haptic.tap();
    if (activeSoundId) {
      captureAnalyticsEvent("audio_stop", { sound_id: activeSoundId });
    }
    stopSound();
  };

  const activeSoundscape = SOUNDSCAPES.find(
    (item) => item.id === activeSoundId
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
        breathScale.value = withTiming(1.3, {
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
  }, [isActive, phase.key, phase.duration, breathScale]);

  const breathCircleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathScale.value }],
  }));

  return (
    <ScrollView
      contentContainerStyle={[styles.content, capStyle]}
      style={[styles.scroll, { backgroundColor: theme.background }]}
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
        <Text style={[styles.sectionHint, { color: theme.mutedText }]}>
          {t("relaxBreathingHint")}
        </Text>

        <Animated.View
          style={[
            styles.breathCircle,
            { backgroundColor: theme.card, borderColor: theme.tint },
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
          onPress={handleBreathToggle}
          style={[styles.button, { backgroundColor: theme.tint }]}
        >
          <Ionicons
            color={theme.onTint}
            name={isActive ? "stop-circle-outline" : "play-circle-outline"}
            size={28}
          />
          <Text style={[styles.buttonText, { color: theme.onTint }]}>
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
        <Text style={[styles.sectionHint, { color: theme.mutedText }]}>
          {t("relaxSoundscapesHint")}
        </Text>
        {activeSoundscape ? (
          <View
            style={[
              styles.nowPlayingBar,
              { backgroundColor: theme.accentSoft, borderColor: theme.tint },
            ]}
          >
            <View
              darkColor="transparent"
              lightColor="transparent"
              style={styles.nowPlayingLeft}
            >
              <Ionicons color={theme.tint} name="volume-medium" size={16} />
              <Text style={[styles.nowPlayingText, { color: theme.text }]}>
                {t(activeSoundscape.labelKey)}
              </Text>
            </View>
            <Pressable
              onPress={stopActiveSoundscape}
              style={styles.nowPlayingStop}
            >
              <Ionicons color={theme.tint} name="stop-circle" size={22} />
            </Pressable>
          </View>
        ) : null}
        <View
          darkColor="transparent"
          lightColor="transparent"
          style={styles.volumeRow}
        >
          {[0.3, 0.6, 0.9].map((level) => {
            const isSelected = Math.abs(volume - level) < 0.01;
            return (
              <Pressable
                key={level}
                onPress={() => {
                  haptic.tap();
                  setVolume(level);
                }}
                style={[
                  styles.volumeChip,
                  {
                    backgroundColor: isSelected ? theme.tint : theme.card,
                    borderColor: isSelected ? theme.tint : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.volumeChipText,
                    { color: isSelected ? theme.onTint : theme.mutedText },
                  ]}
                >
                  VOL {Math.round(level * 100)}%
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View
          darkColor="transparent"
          lightColor="transparent"
          style={styles.sleepTimerWrap}
        >
          <Text style={[styles.sectionLabel, { color: theme.mutedText }]}>
            {t("sleepTimer").toUpperCase()}
          </Text>
          <Text style={[styles.sleepTimerHint, { color: theme.mutedText }]}>
            {t("relaxSleepTimerHint")}
          </Text>
          {sleepTimerEndAt ? (
            <>
              <Text style={[styles.sleepTimerHint, { color: theme.mutedText }]}>
                {t("sleepTimerStopsIn", { minutes: sleepMinutesLeft })}
              </Text>
              <View
                darkColor="transparent"
                lightColor="transparent"
                style={[
                  styles.sleepProgressTrack,
                  { backgroundColor: theme.border },
                ]}
              >
                <View
                  darkColor="transparent"
                  lightColor="transparent"
                  style={[
                    styles.sleepProgressFill,
                    {
                      backgroundColor: theme.tint,
                      width: `${Math.round(
                        Math.min(
                          1,
                          Math.max(
                            0,
                            sleepTimerPresetMinutes
                              ? 1 -
                                  (sleepTimerEndAt - now) /
                                    (sleepTimerPresetMinutes * 60_000)
                              : 0
                          )
                        ) * 100
                      )}%`,
                    },
                  ]}
                />
              </View>
            </>
          ) : null}
          <View
            darkColor="transparent"
            lightColor="transparent"
            style={styles.sleepTimerRow}
          >
            {([null, 10, 20, 30] as Array<number | null>).map((minutes) => {
              const isSelected =
                minutes === null
                  ? sleepTimerEndAt === null
                  : sleepTimerPresetMinutes === minutes;

              return (
                <Pressable
                  key={minutes === null ? "off" : minutes}
                  onPress={() => {
                    haptic.tap();
                    setSleepTimer(minutes);
                  }}
                  style={[
                    styles.sleepTimerChip,
                    {
                      backgroundColor: isSelected ? theme.tint : theme.card,
                      borderColor: isSelected ? theme.tint : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sleepTimerChipText,
                      { color: isSelected ? theme.onTint : theme.mutedText },
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
          darkColor="transparent"
          lightColor="transparent"
          style={styles.soundGrid}
        >
          {SOUNDSCAPES.map((scape, scapeIndex) => {
            const isSoundActive = activeSoundId === scape.id;
            return (
              <Animated.View
                entering={FadeInDown.delay(300 + scapeIndex * 80).springify()}
                key={scape.id}
                style={styles.soundCol}
              >
                <AnimatedPressable
                  onPress={() => toggleSoundscape(scape)}
                  style={[
                    styles.soundCard,
                    {
                      backgroundColor: isSoundActive
                        ? theme.accentSoft
                        : theme.card,
                      borderColor: isSoundActive ? theme.tint : theme.border,
                    },
                  ]}
                >
                  <Ionicons
                    color={isSoundActive ? theme.tint : theme.mutedText}
                    name={scape.icon as never}
                    size={32}
                  />
                  <Text
                    style={[
                      styles.soundLabel,
                      { color: isSoundActive ? theme.tint : theme.text },
                    ]}
                  >
                    {t(scape.labelKey)}
                  </Text>
                  {isSoundActive && (
                    <View
                      darkColor={theme.tint}
                      lightColor={theme.tint}
                      style={[
                        styles.playingDot,
                        { backgroundColor: theme.tint },
                      ]}
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
  breathCircle: {
    alignItems: "center",
    borderRadius: 95,
    borderWidth: 4,
    height: 190,
    justifyContent: "center",
    marginBottom: 32,
    width: 190,
  },

  // Breathing
  breathingSection: {
    alignItems: "center",
    paddingVertical: 16,
  },
  button: {
    alignItems: "center",
    borderRadius: 30,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  content: { padding: 20, paddingBottom: 40 },
  countdown: { fontSize: 48, fontWeight: "700", marginTop: 4 },
  nowPlayingBar: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  nowPlayingLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  nowPlayingStop: {
    paddingLeft: 12,
    paddingVertical: 2,
  },
  nowPlayingText: {
    fontSize: 13,
    fontWeight: "700",
  },
  phaseLabel: { fontSize: 18, fontWeight: "600" },
  playingDot: {
    borderRadius: 4,
    height: 8,
    position: "absolute",
    right: 10,
    top: 10,
    width: 8,
  },
  scroll: { flex: 1 },
  sectionHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
    textAlign: "center",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  sleepProgressFill: {
    borderRadius: 2,
    height: 4,
  },
  sleepProgressTrack: {
    borderRadius: 2,
    height: 4,
    marginBottom: 10,
    overflow: "hidden",
  },
  sleepTimerChip: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sleepTimerChipText: {
    fontSize: 11,
    fontWeight: "700",
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
  sleepTimerWrap: {
    marginBottom: 14,
  },
  soundCard: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 2,
    gap: 10,
    padding: 20,
    position: "relative",
    width: "100%",
  },
  soundCol: {
    width: "47%",
  },
  soundGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  soundLabel: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Soundscapes
  soundscapesSection: {
    marginTop: 32,
  },
  subtitle: { fontSize: 14, marginBottom: 8 },
  volumeChip: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  volumeChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  volumeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
});
