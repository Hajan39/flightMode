import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { KidsShape as Shape } from "@/utils/kidsGames";

/**
 * One flat shape (circle / square / triangle / star) drawn with plain views
 * and a ★ glyph — no SVG dependency. Fills a `size`×`size` box. Decoration
 * only: the caller owns accessibility.
 */
export default function KidsShape({
  color,
  shape,
  size,
}: {
  color: string;
  shape: Shape;
  size: number;
}) {
  const inner = size * 0.82;
  let body: ReactNode;
  if (shape === "circle") {
    body = (
      <View
        style={{
          backgroundColor: color,
          borderRadius: inner / 2,
          height: inner,
          width: inner,
        }}
      />
    );
  } else if (shape === "square") {
    body = (
      <View
        style={{
          backgroundColor: color,
          borderRadius: inner * 0.1,
          height: inner * 0.9,
          width: inner * 0.9,
        }}
      />
    );
  } else if (shape === "triangle") {
    body = (
      <View
        style={[
          styles.triangle,
          {
            borderBottomColor: color,
            borderBottomWidth: inner * 0.88,
            borderLeftWidth: inner / 2,
            borderRightWidth: inner / 2,
          },
        ]}
      />
    );
  } else {
    body = (
      <Text
        style={[
          styles.star,
          { color, fontSize: size * 1.12, lineHeight: size * 1.12 },
        ]}
      >
        ★
      </Text>
    );
  }
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.box, { height: size, width: size }]}
    >
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  // No text selection while a piece is dragged (web ends the drag on select).
  star: { includeFontPadding: false, textAlign: "center", userSelect: "none" },
  triangle: {
    backgroundColor: "transparent",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    height: 0,
    width: 0,
  },
});
