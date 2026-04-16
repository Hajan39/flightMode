import { useRef, useState } from "react";
import {
	Dimensions,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
	ScrollView,
	StyleSheet,
} from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "@/components/Themed";
import AnimatedPressable from "@/components/AnimatedPressable";
import LanguageDropdown from "@/components/LanguageDropdown";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useTranslation } from "@/hooks/useTranslation";
import { useSettingsStore } from "@/store/useSettingsStore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type PageProps = {
	icon: string;
	title: string;
	subtitle: string;
	theme: (typeof Colors)["dark"];
	isLanguagePage?: boolean;
};

function Page({ icon, title, subtitle, theme, isLanguagePage }: PageProps) {
	return (
		<View style={[styles.page, { width: SCREEN_WIDTH }]}>
			<Animated.View
				entering={ZoomIn.delay(200).springify()}
				style={[
					styles.iconCircle,
					{ backgroundColor: theme.accentSoft, borderColor: theme.border },
				]}
			>
				<Ionicons name={icon as never} size={56} color={theme.tint} />
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
			{isLanguagePage && (
				<Animated.View
					entering={FadeInDown.delay(550).springify()}
					style={styles.languagePicker}
				>
					<LanguageDropdown showSystemOption={false} />
				</Animated.View>
			)}
		</View>
	);
}

export default function OnboardingScreen() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const router = useRouter();
	const { t } = useTranslation();
	const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);
	const scrollRef = useRef<ScrollView>(null);
	const [activeIndex, setActiveIndex] = useState(0);

	const pages = [
		{
			icon: "language-outline",
			title: t("onboardingLanguageTitle"),
			subtitle: t("onboardingLanguageSubtitle"),
			isLanguagePage: true,
		},
		{
			icon: "airplane",
			title: t("onboardingTitle1"),
			subtitle: t("onboardingSubtitle1"),
		},
		{
			icon: "game-controller-outline",
			title: t("onboardingTitle2"),
			subtitle: t("onboardingSubtitle2"),
		},
		{
			icon: "compass-outline",
			title: t("onboardingTitle3"),
			subtitle: t("onboardingSubtitle3"),
		},
	];

	const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
		const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
		setActiveIndex(index);
	};

	const finish = () => {
		completeOnboarding();
		router.replace("/(tabs)");
	};

	const isLast = activeIndex === pages.length - 1;

	return (
		<View style={[styles.root, { backgroundColor: theme.background }]}>
			{/* Skip */}
			<AnimatedPressable style={styles.skipBtn} onPress={finish}>
				<Text style={[styles.skipText, { color: theme.mutedText }]}>
					{t("onboardingSkip")}
				</Text>
			</AnimatedPressable>

			{/* Pages */}
			<ScrollView
				ref={scrollRef}
				horizontal
				pagingEnabled
				showsHorizontalScrollIndicator={false}
				onMomentumScrollEnd={handleScroll}
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
				style={[styles.ctaBtn, { backgroundColor: theme.tint }]}
				onPress={() => {
					if (isLast) {
						finish();
					} else {
						scrollRef.current?.scrollTo({
							x: (activeIndex + 1) * SCREEN_WIDTH,
							animated: true,
						});
					}
				}}
			>
				<Text style={styles.ctaText}>
					{isLast ? t("onboardingGetStarted") : t("onboardingNext")}
				</Text>
			</AnimatedPressable>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, paddingBottom: 48 },
	skipBtn: { position: "absolute", top: 56, right: 20, zIndex: 10 },
	skipText: { fontSize: 15, fontWeight: "600" },
	scroller: { flex: 1 },
	page: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 40,
		gap: 16,
	},
	iconCircle: {
		width: 120,
		height: 120,
		borderRadius: 60,
		borderWidth: 1,
		justifyContent: "center",
		alignItems: "center",
		marginBottom: 8,
	},
	title: { fontSize: 26, fontWeight: "900", textAlign: "center" },
	subtitle: {
		fontSize: 15,
		fontWeight: "500",
		textAlign: "center",
		lineHeight: 22,
	},
	languagePicker: {
		width: "100%",
		marginTop: 8,
	},
	dotsRow: {
		flexDirection: "row",
		justifyContent: "center",
		gap: 8,
		marginBottom: 24,
	},
	dot: { width: 8, height: 8, borderRadius: 4 },
	ctaBtn: {
		marginHorizontal: 20,
		paddingVertical: 16,
		borderRadius: 14,
		alignItems: "center",
	},
	ctaText: {
		color: "#fff",
		fontSize: 17,
		fontWeight: "900",
		letterSpacing: 0.5,
	},
});
