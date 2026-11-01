import { StyleSheet, Text, View } from "react-native";

/**
 * Progress as pictures (no numbers, no score): `done` bright stars out of
 * `total`. Hidden from screen readers — it is decoration for the child.
 */
export default function KidsStars({
  done,
  total,
}: {
  done: number;
  total: number;
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.row}
    >
      {Array.from({ length: total }, (_, i) => (
        <Text
          key={`star-${i < done ? "on" : "off"}-${String(i)}`}
          style={[styles.star, i < done ? null : styles.off]}
        >
          ⭐
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  off: { opacity: 0.2 },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    justifyContent: "center",
    minHeight: 40,
    paddingVertical: 6,
  },
  star: { fontSize: 26, lineHeight: 32 },
});
