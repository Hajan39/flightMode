import { Pressable, Text, View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useTranslation } from "@/hooks/useTranslation";
import { useAudioStore } from "@/store/useAudioStore";
import { useAchievementStore } from "@/store/useAchievementStore";

export default function TabLayout() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const router = useRouter();
	const activeSoundId = useAudioStore((s) => s.activeSoundId);
	const activeLabelKey = useAudioStore((s) => s.activeLabelKey);
	const stopSound = useAudioStore((s) => s.stopSound);
	const newUnlockedCount = useAchievementStore((s) => s.newUnlockedIds.length);

	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: theme.tint,
				tabBarInactiveTintColor: theme.tabIconDefault,
				tabBarStyle: {
					backgroundColor: theme.headerBackground,
					borderTopColor: theme.border,
				},
				headerStyle: {
					backgroundColor: theme.headerBackground,
				},
				headerTitleStyle: {
					color: theme.text,
				},
				headerTintColor: theme.text,
				sceneStyle: {
					backgroundColor: theme.background,
				},
				headerShown: true,
				headerRight: () => (
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							paddingRight: 16,
							gap: 12,
						}}
					>
						{activeSoundId ? (
							<View
								style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
							>
								<Text
									style={{
										color: theme.tint,
										fontSize: 12,
										fontWeight: "700",
										maxWidth: 84,
									}}
									numberOfLines={1}
								>
									{activeLabelKey ? t(activeLabelKey) : t("audioFallback")}
								</Text>
								<Pressable onPress={stopSound} hitSlop={8}>
									<Ionicons
										name="stop-circle-outline"
										size={22}
										color={theme.tint}
									/>
								</Pressable>
							</View>
						) : null}
						<Pressable onPress={() => router.push("/profile")} hitSlop={8}>
							<View>
								<Ionicons
									name="person-circle-outline"
									size={22}
									color={theme.text}
								/>
								{newUnlockedCount > 0 && (
									<View
										style={{
											position: "absolute",
											top: -4,
											right: -4,
											backgroundColor: theme.tint,
											borderRadius: 8,
											minWidth: 16,
											height: 16,
											alignItems: "center",
											justifyContent: "center",
										}}
									>
										<Text
											style={{
												color: "#fff",
												fontSize: 10,
												fontWeight: "700",
											}}
										>
											{newUnlockedCount}
										</Text>
									</View>
								)}
							</View>
						</Pressable>
						<Pressable onPress={() => router.push("/settings")} hitSlop={8}>
							<Ionicons name="settings-outline" size={22} color={theme.text} />
						</Pressable>
					</View>
				),
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: t("tabsHome"),
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="home-outline" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="games"
				options={{
					title: t("tabsGames"),
					tabBarIcon: ({ color, size }) => (
						<Ionicons
							name="game-controller-outline"
							size={size}
							color={color}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="explore"
				options={{
					title: t("tabsExplore"),
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="compass-outline" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="relax"
				options={{
					title: t("tabsRelax"),
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="leaf-outline" size={size} color={color} />
					),
				}}
			/>
		</Tabs>
	);
}
