import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useTranslation } from "@/hooks/useTranslation";
import { useAchievementStore } from "@/store/useAchievementStore";
import { useAudioStore } from "@/store/useAudioStore";

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
        headerRight: () => (
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: 12,
              paddingRight: 16,
            }}
          >
            {activeSoundId ? (
              <View
                style={{ alignItems: "center", flexDirection: "row", gap: 6 }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: theme.tint,
                    fontSize: 12,
                    fontWeight: "700",
                    maxWidth: 84,
                  }}
                >
                  {activeLabelKey ? t(activeLabelKey) : t("audioFallback")}
                </Text>
                <Pressable
                  accessibilityLabel={t("a11yStopSound")}
                  accessibilityRole="button"
                  hitSlop={12}
                  onPress={stopSound}
                >
                  <Ionicons
                    color={theme.tint}
                    name="stop-circle-outline"
                    size={22}
                  />
                </Pressable>
              </View>
            ) : null}
            <Pressable
              accessibilityLabel={
                newUnlockedCount > 0
                  ? t("a11yProfileNewAchievements", { count: newUnlockedCount })
                  : t("a11yOpenProfile")
              }
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => router.push("/profile")}
            >
              <View>
                <Ionicons
                  color={theme.text}
                  name="person-circle-outline"
                  size={22}
                />
                {newUnlockedCount > 0 && (
                  <View
                    style={{
                      alignItems: "center",
                      backgroundColor: theme.tint,
                      borderRadius: 999,
                      justifyContent: "center",
                      minHeight: 16,
                      minWidth: 16,
                      paddingHorizontal: 3,
                      position: "absolute",
                      right: -4,
                      top: -4,
                    }}
                  >
                    <Text
                      maxFontSizeMultiplier={1.6}
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
            <Pressable
              accessibilityLabel={t("a11yOpenSettings")}
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => router.push("/settings")}
            >
              <Ionicons color={theme.text} name="settings-outline" size={22} />
            </Pressable>
          </View>
        ),
        headerShown: true,
        headerStyle: {
          backgroundColor: theme.headerBackground,
        },
        headerTintColor: theme.text,
        headerTitleStyle: {
          color: theme.text,
        },
        sceneStyle: {
          backgroundColor: theme.background,
        },
        tabBarActiveTintColor: theme.tint,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          backgroundColor: theme.headerBackground,
          borderTopColor: theme.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="home-outline" size={size} />
          ),
          title: t("tabsHome"),
        }}
      />
      <Tabs.Screen
        name="games"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              color={color}
              name="game-controller-outline"
              size={size}
            />
          ),
          title: t("tabsGames"),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="compass-outline" size={size} />
          ),
          title: t("tabsExplore"),
        }}
      />
      <Tabs.Screen
        name="relax"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="leaf-outline" size={size} />
          ),
          title: t("tabsRelax"),
        }}
      />
    </Tabs>
  );
}
