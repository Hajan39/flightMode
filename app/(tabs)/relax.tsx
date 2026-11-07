import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import AnimatedPressable from "@/components/AnimatedPressable";
import PlusBadge from "@/components/PlusBadge";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useHaptic } from "@/hooks/useHaptic";
import { useTabletLayout } from "@/hooks/useTabletLayout";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/translations";
import { useAchievementStore } from "@/store/useAchievementStore";
import { useAudioStore } from "@/store/useAudioStore";
import { useSupporterStore } from "@/store/useSupporterStore";
import { captureAnalyticsEvent } from "@/utils/analytics";
import {
  BREATH_PATTERNS,
  BREATH_PHASE_LABEL_KEY,
  BREATH_PHASE_SCALE,
  type BreathPattern,
  type BreathPatternId,
  canUseBreathPattern,
  DEFAULT_BREATH_PATTERN_ID,
  getBreathPattern,
  getBreathPosition,
} from "@/utils/breathing";
import { trackFirstSessionCompleted } from "@/utils/firstSession";

/** Wall-clock poll for the breathing circle (timing never depends on it). */
const BREATH_TICK_MS = 200;

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

  const router = useRouter();
  const plus = useSupporterStore((s) => s.plus);

  // Breathing state — wall-clock based: the phase is derived from
  // `Date.now() - startedAt`, never from chained ticks.
  const [patternId, setPatternId] = useState<BreathPatternId>(
    DEFAULT_BREATH_PATTERN_ID
  );
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [breathNow, setBreathNow] = useState(Date.now());
  const isActive = startedAt !== null;
  // A Plus pattern picked earlier falls back to box breathing if Plus is gone.
  const selectedPattern = getBreathPattern(patternId);
  const pattern = canUseBreathPattern(selectedPattern, plus)
    ? selectedPattern
    : getBreathPattern(DEFAULT_BREATH_PATTERN_ID);

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

  // Leaving the tab stops the exercise: no countdown or haptic pulses while
  // the traveller is in a game or another screen.
  useFocusEffect(
    useCallback(
      () => () => {
        setStartedAt(null);
      },
      []
    )
  );

  // Breathing clock: only re-reads the wall clock; the phase maths lives in
  // getBreathPosition().
  useEffect(() => {
    if (startedAt === null) {
      return;
    }
    setBreathNow(Date.now());
    const tick = setInterval(() => setBreathNow(Date.now()), BREATH_TICK_MS);
    return () => clearInterval(tick);
  }, [startedAt]);

  const position = getBreathPosition(
    pattern,
    startedAt === null ? 0 : breathNow - startedAt
  );
  const { phaseIndex } = position;
  // Changes once per phase (including the same phase in the next cycle).
  const phaseStep = position.cycle * pattern.phases.length + phaseIndex;

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
  const phaseStartedRef = useRef<boolean>(false);
  useEffect(() => {
    if (!isActive) {
      phaseStartedRef.current = false;
      return;
    }
    if (!phaseStartedRef.current) {
      phaseStartedRef.current = true;
      return;
    }
    haptic.tap();
    // Pulses once per phase change only: the deps are the phase step, not the
    // wall-clock tick. `haptic` is omitted but harmless either way —
    // useHaptic() returns one stable module-level object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseStep, isActive]);

  const handleBreathToggle = () => {
    haptic.tap();
    if (isActive) {
      setStartedAt(null);
      captureAnalyticsEvent("relax_finish", { exercise: pattern.analyticsId });
      trackFirstSessionCompleted("relax");
    } else {
      setStartedAt(Date.now());
      incrementRelax();
      captureAnalyticsEvent("relax_start", { exercise: pattern.analyticsId });
    }
  };

  const handlePatternPress = (next: BreathPattern) => {
    haptic.tap();
    if (!canUseBreathPattern(next, plus)) {
      captureAnalyticsEvent("premium_view", {
        item: next.analyticsId,
        placement: "breathing",
      });
      router.push("/plus" as never);
      return;
    }
    if (next.id === pattern.id) {
      return;
    }
    setPatternId(next.id);
    // A running session restarts from the first inhale of the new pattern.
    if (isActive) {
      setStartedAt(Date.now());
    }
  };

  const toggleSoundscape = (scape: SoundscapeDef) => {
    haptic.tap();
    const isStoppingActiveSoundscape = activeSoundId === scape.id;
    playSound(scape.id, scape.labelKey, scape.source, t(scape.labelKey));
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

  const phaseKind = pattern.phases[phaseIndex]?.kind ?? "in";

  // Breathing circle animation
  const breathScale = useSharedValue(1);
  const phaseRemainingRef = useRef(position.remainingMs);
  phaseRemainingRef.current = position.remainingMs;

  // One key per phase of a session: a new phase (or a restarted session)
  // starts a new animation, wall-clock ticks inside a phase do not.
  const breathAnimKey = startedAt === null ? null : `${startedAt}:${phaseStep}`;
  useEffect(() => {
    if (breathAnimKey === null) {
      breathScale.value = withTiming(1, { duration: 300 });
      return;
    }
    // Inhale → grow, top-up inhale → grow a bit more, exhale → shrink,
    // hold → stay. Animates over what is left of the phase (wall clock).
    const target = BREATH_PHASE_SCALE[phaseKind];
    if (target !== null) {
      breathScale.value = withTiming(target, {
        duration: phaseRemainingRef.current,
        easing: Easing.inOut(Easing.ease),
      });
    }
  }, [breathAnimKey, phaseKind, breathScale]);

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
        <Text style={[styles.sectionHint, { color: theme.mutedText }]}>
          {t("relaxBreathingHint")}
        </Text>
        <ScrollView
          contentContainerStyle={styles.patternRow}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.patternScroll}
        >
          {BREATH_PATTERNS.map((item) => {
            const isSelected = item.id === pattern.id;
            const locked = !canUseBreathPattern(item, plus);
            return (
              <Pressable
                accessibilityLabel={
                  locked
                    ? t("a11yBreathPatternPlus", { name: t(item.nameKey) })
                    : t(item.nameKey)
                }
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                key={item.id}
                onPress={() => handlePatternPress(item)}
                style={[
                  styles.patternChip,
                  {
                    backgroundColor: isSelected ? theme.tint : theme.card,
                    borderColor: isSelected ? theme.tint : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.patternChipText,
                    { color: isSelected ? theme.onTint : theme.text },
                  ]}
                >
                  {t(item.nameKey)}
                </Text>
                {locked ? <PlusBadge /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
        <Text style={[styles.subtitle, { color: theme.text }]}>
          {t(pattern.nameKey)}
        </Text>
        <Text style={[styles.sectionHint, { color: theme.mutedText }]}>
          {t(pattern.descriptionKey)}
        </Text>

        <Animated.View
          style={[
            styles.breathCircle,
            { backgroundColor: theme.card, borderColor: theme.tint },
            breathCircleStyle,
          ]}
        >
          <Text style={[styles.phaseLabel, { color: theme.tint }]}>
            {isActive ? t(BREATH_PHASE_LABEL_KEY[phaseKind]) : t("ready")}
          </Text>
          <Text style={[styles.countdown, { color: theme.tint }]}>
            {isActive ? position.secondsLeft : "—"}
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
              accessibilityLabel={t("a11yStopSound")}
              accessibilityRole="button"
              hitSlop={12}
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
          style={styles.soundGrid}
        >
          {SOUNDSCAPES.map((scape, scapeIndex) => {
            const isScapeActive = activeSoundId === scape.id;
            return (
              <Animated.View
                entering={FadeInDown.delay(300 + scapeIndex * 80).springify()}
                key={scape.id}
                style={styles.soundCol}
              >
                <AnimatedPressable
                  accessibilityState={{ selected: isScapeActive }}
                  onPress={() => toggleSoundscape(scape)}
                  style={[
                    styles.soundCard,
                    {
                      backgroundColor: isScapeActive
                        ? theme.accentSoft
                        : theme.card,
                      borderColor: isScapeActive ? theme.tint : theme.border,
                    },
                  ]}
                >
                  <Ionicons
                    color={isScapeActive ? theme.tint : theme.mutedText}
                    name={scape.icon as never}
                    size={32}
                  />
                  <Text
                    style={[
                      styles.soundLabel,
                      { color: isScapeActive ? theme.tint : theme.text },
                    ]}
                  >
                    {t(scape.labelKey)}
                  </Text>
                  {isScapeActive && (
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
        <View
          darkColor="transparent"
          lightColor="transparent"
          style={styles.volumeRow}
        >
          {[0.3, 0.6, 0.9].map((level) => {
            const isSelected = Math.abs(volume - level) < 0.01;
            return (
              <Pressable
                accessibilityLabel={t("a11yVolumePercent", {
                  percent: Math.round(level * 100),
                })}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
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
                  {t("relaxVolumeChip", { percent: Math.round(level * 100) })}
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
                  accessibilityLabel={
                    minutes === null
                      ? `${t("sleepTimer")}: ${t("sleepTimerOff")}`
                      : t("a11ySleepTimerMinutes", { minutes })
                  }
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
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
                    {minutes === null
                      ? t("sleepTimerOff")
                      : t("minutesShort", { minutes })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
  patternChip: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  patternChipText: { fontSize: 12, fontWeight: "700" },
  patternRow: { gap: 8, paddingHorizontal: 4 },
  patternScroll: { alignSelf: "stretch", flexGrow: 0, marginBottom: 12 },
  phaseLabel: { fontSize: 18, fontWeight: "600", textAlign: "center" },
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
    justifyContent: "center",
    minHeight: 44,
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
  subtitle: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  volumeChip: {
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
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
    marginTop: 16,
  },
});
