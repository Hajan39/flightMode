import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  Dimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
} from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import AnimatedPressable from "@/components/AnimatedPressable";
import CurrencyPicker from "@/components/CurrencyPicker";
import LanguageDropdown from "@/components/LanguageDropdown";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { deviceCurrencyCode, POPULAR_CURRENCIES } from "@/data/currencies";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useSettingsStore } from "@/store/useSettingsStore";
import type { GameCategory } from "@/types/game";
import { captureAnalyticsEvent } from "@/utils/analytics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const PREF_CATEGORIES: GameCategory[] = [
  "brain",
  "reflex",
  "strategy",
  "multiplayer",
];

function CategoryPicker({ theme }: { theme: (typeof Colors)["dark"] }) {
  const { t } = useTranslation();
  const preferred = useSettingsStore((s) => s.preferredCategories);
  const toggle = useSettingsStore((s) => s.togglePreferredCategory);
  const haptic = useHaptic();
  return (
    <View
      darkColor="transparent"
      lightColor="transparent"
      style={styles.prefWrap}
    >
      {PREF_CATEGORIES.map((cat) => {
        const active = preferred.includes(cat);
        return (
          <AnimatedPressable
            key={cat}
            onPress={() => {
              haptic.tap();
              toggle(cat);
            }}
            style={[
              styles.prefChip,
              {
                backgroundColor: active ? theme.tint : theme.card,
                borderColor: active ? theme.tint : theme.border,
              },
            ]}
          >
            <Text
              style={[
                styles.prefChipText,
                { color: active ? theme.onTint : theme.text },
              ]}
            >
              {t(`categoryFilter_${cat}`)}
            </Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

interface PageProps {
  icon: string;
  isCurrencyPage?: boolean;
  isLanguagePage?: boolean;
  isPreferencesPage?: boolean;
  subtitle: string;
  theme: (typeof Colors)["dark"];
  title: string;
}

/** Home-currency step: chips + the shared searchable picker. */
function HomeCurrencyPicker() {
  const homeCurrency = useSettingsStore((s) => s.homeCurrency);
  const setHomeCurrency = useSettingsStore((s) => s.setHomeCurrency);
  const selected = homeCurrency ?? deviceCurrencyCode();

  return (
    <CurrencyPicker
      chipCodes={POPULAR_CURRENCIES}
      onSelect={setHomeCurrency}
      selected={selected}
    />
  );
}

function Page({
  icon,
  title,
  subtitle,
  theme,
  isLanguagePage,
  isPreferencesPage,
  isCurrencyPage,
}: PageProps) {
  return (
    <View style={[styles.page, { width: SCREEN_WIDTH }]}>
      <Animated.View
        entering={ZoomIn.delay(200).springify()}
        style={[
          styles.iconCircle,
          { backgroundColor: theme.accentSoft, borderColor: theme.border },
        ]}
      >
        <Ionicons color={theme.tint} name={icon as never} size={56} />
      </Animated.View>
      <Animated.Text
        entering={FadeInDown.delay(350).springify()}
        style={[styles.title, { color: theme.text }]}
      >
        {title}
      </Animated.Text>
      <Animated.Text
        entering={FadeInDown.delay(450).springify()}
        style={[styles.subtitle, { color: theme.mutedText }]}
      >
        {subtitle}
      </Animated.Text>
      {isLanguagePage ? (
        <Animated.View
          entering={FadeInDown.delay(550).springify()}
          style={styles.languagePicker}
        >
          <LanguageDropdown showSystemOption={false} />
        </Animated.View>
      ) : null}
      {isPreferencesPage ? (
        <Animated.View entering={FadeInDown.delay(550).springify()}>
          <CategoryPicker theme={theme} />
        </Animated.View>
      ) : null}
      {isCurrencyPage ? (
        <Animated.View
          entering={FadeInDown.delay(550).springify()}
          style={styles.currencyPicker}
        >
          <HomeCurrencyPicker />
        </Animated.View>
      ) : null}
    </View>
  );
}

export default function OnboardingScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { t } = useTranslation();
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);
  const haptic = useHaptic();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const pages = [
    {
      icon: "language-outline",
      isLanguagePage: true,
      subtitle: t("onboardingLanguageSubtitle"),
      title: t("onboardingLanguageTitle"),
    },
    {
      icon: "airplane",
      subtitle: t("onboardingSubtitle1"),
      title: t("onboardingTitle1"),
    },
    {
      icon: "game-controller-outline",
      subtitle: t("onboardingSubtitle2"),
      title: t("onboardingTitle2"),
    },
    {
      icon: "heart-outline",
      isPreferencesPage: true,
      subtitle: t("onboardingPrefsSubtitle"),
      title: t("onboardingPrefsTitle"),
    },
    {
      icon: "cash-outline",
      isCurrencyPage: true,
      subtitle: t("onboardingCurrencySubtitle"),
      title: t("onboardingCurrencyTitle"),
    },
    {
      icon: "compass-outline",
      subtitle: t("onboardingSubtitle3"),
      title: t("onboardingTitle3"),
    },
  ];

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(index);
  };

  const finish = () => {
    haptic.success();
    captureAnalyticsEvent("onboarding_complete", {
      page_count: pages.length,
      page_index: activeIndex,
    });
    completeOnboarding();
    router.replace("/(tabs)");
  };

  const isLast = activeIndex === pages.length - 1;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Skip */}
      <AnimatedPressable
        onPress={() => {
          haptic.tap();
          finish();
        }}
        style={styles.skipBtn}
      >
        <Text style={[styles.skipText, { color: theme.mutedText }]}>
          {t("onboardingSkip")}
        </Text>
      </AnimatedPressable>

      {/* Pages */}
      <ScrollView
        horizontal
        onMomentumScrollEnd={handleScroll}
        pagingEnabled
        ref={scrollRef}
        showsHorizontalScrollIndicator={false}
        style={styles.scroller}
      >
        {pages.map((p, i) => (
          <Page key={i} {...p} theme={theme} />
        ))}
      </ScrollView>

      {/* Dots */}
      <View style={styles.dotsRow}>
        {pages.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor:
                  i === activeIndex ? theme.tint : theme.progressTrack,
                width: i === activeIndex ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      {/* CTA */}
      <AnimatedPressable
        onPress={() => {
          if (isLast) {
            finish();
          } else {
            haptic.tap();
            // Android fires onMomentumScrollEnd late (or not at all) for a
            // programmatic scroll — update the index here so dots + CTA follow.
            setActiveIndex(activeIndex + 1);
            scrollRef.current?.scrollTo({
              animated: true,
              x: (activeIndex + 1) * SCREEN_WIDTH,
            });
          }
        }}
        style={[styles.ctaBtn, { backgroundColor: theme.tint }]}
      >
        <Text style={[styles.ctaText, { color: theme.onTint }]}>
          {isLast ? t("onboardingGetStarted") : t("onboardingNext")}
        </Text>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  ctaBtn: {
    alignItems: "center",
    borderRadius: 14,
    marginHorizontal: 20,
    paddingVertical: 16,
  },
  ctaText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  currencyPicker: {
    alignSelf: "stretch",
    marginTop: 24,
    paddingHorizontal: 12,
  },
  dot: { borderRadius: 4, height: 8, width: 8 },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginBottom: 24,
  },
  iconCircle: {
    alignItems: "center",
    borderRadius: 60,
    borderWidth: 1,
    height: 120,
    justifyContent: "center",
    marginBottom: 8,
    width: 120,
  },
  languagePicker: {
    marginTop: 8,
    width: "100%",
  },
  page: {
    alignItems: "center",
    flex: 1,
    gap: 16,
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  prefChip: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  prefChipText: { fontSize: 15, fontWeight: "600" },
  prefWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    marginTop: 20,
    paddingHorizontal: 8,
  },
  root: { flex: 1, paddingBottom: 48 },
  scroller: { flex: 1 },
  skipBtn: { position: "absolute", right: 20, top: 56, zIndex: 10 },
  skipText: { fontSize: 15, fontWeight: "600" },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 22,
    textAlign: "center",
  },
  title: { fontSize: 26, fontWeight: "900", textAlign: "center" },
});
