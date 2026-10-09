/**
 * Learn more about Light and Dark modes:
 * https://docs.expo.io/guides/color-schemes/
 */
import { Text as DefaultText, View as DefaultView } from "react-native";
import Colors from "@/constants/Colors";
import { baseScheme } from "./colorSchemes";
import { useColorScheme } from "./useColorScheme";

interface ThemeProps {
  crazyColor?: string;
  darkColor?: string;
  lightColor?: string;
}

export type TextProps = ThemeProps & DefaultText["props"];
export type ViewProps = ThemeProps & DefaultView["props"];

export function useThemeColor(
  props: { light?: string; dark?: string; crazy?: string },
  colorName: keyof typeof Colors.light &
    keyof typeof Colors.dark &
    keyof typeof Colors.crazy
) {
  const theme = useColorScheme();
  const colorFromProps = props[baseScheme(theme)];

  if (colorFromProps) {
    return colorFromProps;
  }
  return Colors[theme][colorName];
}

export function Text(props: TextProps) {
  const { style, lightColor, darkColor, crazyColor, ...otherProps } = props;
  const color = useThemeColor(
    { crazy: crazyColor, dark: darkColor, light: lightColor },
    "text"
  );

  return <DefaultText style={[{ color }, style]} {...otherProps} />;
}

export function View(props: ViewProps) {
  const { style, lightColor, darkColor, crazyColor, ...otherProps } = props;
  const backgroundColor = useThemeColor(
    { crazy: crazyColor, dark: darkColor, light: lightColor },
    "background"
  );

  return <DefaultView style={[{ backgroundColor }, style]} {...otherProps} />;
}
