import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme";

// Tandem logo — drawn with pure React Native Views, zero SVG dependency
// Outer ring + rays made from rotated thin Views, inner circle, wordmark

interface TandemLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showWordmark?: boolean;
}

const CONFIG = {
  sm: { outer: 32, text: 17, rays: 8 },
  md: { outer: 40, text: 21, rays: 10 },
  lg: { outer: 54, text: 28, rays: 12 },
  xl: { outer: 68, text: 36, rays: 12 },
};

const NUM_RAYS = 12;

export const TandemLogo = ({ size = "md", showWordmark = true }: TandemLogoProps) => {
  const c = CONFIG[size];
  const outer = c.outer;
  const inner = outer * 0.44;
  const rayLen = outer * 0.22;
  const rayW = outer * 0.07;

  return (
    <View style={styles.row}>
      {/* Sun mark */}
      <View style={{ width: outer, height: outer, alignItems: "center", justifyContent: "center" }}>
        {/* Rays — each ray lives in a full-size wrapper that rotates around the logo center */}
        {Array.from({ length: NUM_RAYS }).map((_, i) => (
          <View
            key={i}
            style={{
              position: "absolute",
              width: outer,
              height: outer,
              alignItems: "center",
              transform: [{ rotate: `${(i * 360) / NUM_RAYS}deg` }],
            }}
          >
            <View
              style={{
                width: rayW,
                height: rayLen,
                borderRadius: rayW / 2,
                backgroundColor: "#2DD4BF",
                marginTop: outer * 0.05,
              }}
            />
          </View>
        ))}

        {/* Outer ring */}
        <View
          style={{
            position: "absolute",
            width: outer * 0.88,
            height: outer * 0.88,
            borderRadius: outer * 0.44,
            borderWidth: outer * 0.04,
            borderColor: "#2DD4BF",
          }}
        />

        {/* Inner gradient circle */}
        <LinearGradient
          colors={["#5eead4", "#2DD4BF"]}
          style={{
            width: inner,
            height: inner,
            borderRadius: inner / 2,
          }}
        >
          {/* Highlight dot */}
          <View
            style={{
              position: "absolute",
              width: inner * 0.28,
              height: inner * 0.28,
              borderRadius: inner * 0.14,
              backgroundColor: "rgba(255,255,255,0.25)",
              top: inner * 0.15,
              left: inner * 0.15,
            }}
          />
        </LinearGradient>
      </View>

      {/* Wordmark */}
      {showWordmark && (
        <Text style={[styles.wordmark, { fontSize: c.text }]}>tandem</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  wordmark: {
    fontWeight: "800",
    fontFamily: "Quicksand_700Bold",
    color: colors.teal,
    letterSpacing: -0.5,
  },
});
