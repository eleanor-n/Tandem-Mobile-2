import React from "react";
import { View, Image, StyleSheet, ImageStyle, ViewStyle, StyleProp } from "react-native";

export type Tier = "new" | "known" | "trusted";

interface Props {
  uri?: string | null;
  size: number;
  tier?: Tier | null;
  // Optional fallback element rendered when no uri is provided (e.g. initial).
  fallback?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

// Renders a profile photo wrapped in the tier ring per the brand spec:
//   new      → no ring
//   known    → 2px teal ring with 2px gap from the photo
//   trusted  → 3px gold ring + 2px gap + a soft outer glow
//
// Total outer diameter is `size`. The inner photo shrinks to leave room for
// the ring + gap so the avatar's grid alignment isn't disturbed.
export function TierAvatar({ uri, size, tier, fallback, style, imageStyle }: Props) {
  const t = (tier ?? "new") as Tier;
  const ringWidth = t === "trusted" ? 3 : t === "known" ? 2 : 0;
  const gap = t === "new" ? 0 : 2;
  const innerSize = size - 2 * (ringWidth + gap);
  const innerRadius = innerSize / 2;

  const ringColor = t === "trusted" ? "#FFD166" : t === "known" ? "#2DD4BF" : "transparent";

  const photo = uri ? (
    <Image
      source={{ uri }}
      style={[
        { width: innerSize, height: innerSize, borderRadius: innerRadius, backgroundColor: "#F3F4F6" },
        imageStyle,
      ]}
    />
  ) : (
    <View
      style={[
        { width: innerSize, height: innerSize, borderRadius: innerRadius, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
        imageStyle as any,
      ]}
    >
      {fallback}
    </View>
  );

  if (t === "new") {
    return <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>{photo}</View>;
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ringWidth,
          borderColor: ringColor,
          alignItems: "center",
          justifyContent: "center",
        },
        t === "trusted" && s.trustedGlow,
        style,
      ]}
    >
      {photo}
    </View>
  );
}

const s = StyleSheet.create({
  trustedGlow: {
    shadowColor: "#FFD166",
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
});

export function tierLabel(tier?: Tier | null): string | null {
  if (tier === "trusted") return "Trusted Tandemer";
  if (tier === "known") return "Known Tandemer";
  return null;
}
