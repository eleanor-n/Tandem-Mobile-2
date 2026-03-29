import React, { useEffect, useRef } from "react";
import { Animated, View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// Sunny avatar — pure React Native, zero SVG
// Teal gradient ring + sky interior + golden sun rays + core circle

export type SunnyExpression = "warm" | "excited" | "smirky" | "shocked" | "proud" | "thinking" | "celebratory";

const EXPRESSION_SCALE: Record<SunnyExpression, number> = {
  warm: 1.0, excited: 1.08, smirky: 1.02,
  shocked: 1.12, proud: 1.15, thinking: 0.97, celebratory: 1.2,
};

const SUN_RAYS = 12;

interface SunnyAvatarProps {
  expression?: SunnyExpression;
  size?: number;
  isTalking?: boolean;
}

const SunnyAvatar = ({ expression = "warm", size = 48, isTalking = false }: SunnyAvatarProps) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const rippleAnim = useRef(new Animated.Value(1)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Scale on expression change
  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: EXPRESSION_SCALE[expression],
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [expression]);

  // Slow rotate for warmth
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: expression === "excited" || expression === "celebratory" ? 2000 : 8000,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [expression]);

  // Talking ripple
  useEffect(() => {
    if (isTalking) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(rippleAnim, { toValue: 1.6, duration: 700, useNativeDriver: true }),
            Animated.timing(rippleOpacity, { toValue: 0.5, duration: 100, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(rippleAnim, { toValue: 1, duration: 0, useNativeDriver: true }),
            Animated.timing(rippleOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
          ]),
        ])
      );
      loop.start();
      return () => { loop.stop(); rippleAnim.setValue(1); rippleOpacity.setValue(0); };
    }
  }, [isTalking]);

  // Excited pulse
  useEffect(() => {
    if (expression === "excited" || expression === "celebratory") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 400, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => { loop.stop(); pulseAnim.setValue(1); };
    } else {
      pulseAnim.setValue(1);
    }
  }, [expression]);

  const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const ringW = Math.max(2, size * 0.07);
  const innerSize = size - ringW * 2;
  const sunSize = innerSize * 0.65;
  const rayLen = sunSize * 0.3;
  const rayW = Math.max(1.5, sunSize * 0.08);
  const coreR = sunSize * 0.36;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* Ripple ring */}
      <Animated.View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: "#2DD4BF",
          transform: [{ scale: rippleAnim }],
          opacity: rippleOpacity,
        }}
      />

      {/* Main avatar */}
      <Animated.View
        style={{
          width: size, height: size, borderRadius: size / 2,
          transform: [{ scale: Animated.multiply(scaleAnim, pulseAnim) }],
          overflow: "hidden",
        }}
      >
        {/* Gradient ring */}
        <LinearGradient
          colors={["#2DD4BF", "#3B82F6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: size, height: size, borderRadius: size / 2, padding: ringW }}
        >
          {/* Sky blue interior */}
          <LinearGradient
            colors={["#E0F2FE", "#BAE6FD", "#7DD3FC"]}
            style={{ flex: 1, borderRadius: innerSize / 2, alignItems: "center", justifyContent: "center" }}
          >
            {/* Spinning sun */}
            <Animated.View
              style={{
                width: sunSize, height: sunSize,
                alignItems: "center", justifyContent: "center",
                transform: [{ rotate: spin }],
              }}
            >
              {/* Rays — each ray lives in a full-size wrapper that rotates around the sun center */}
              {Array.from({ length: SUN_RAYS }).map((_, i) => (
                <View
                  key={i}
                  style={{
                    position: "absolute",
                    width: sunSize,
                    height: sunSize,
                    alignItems: "center",
                    transform: [{ rotate: `${(i * 360) / SUN_RAYS}deg` }],
                  }}
                >
                  <View
                    style={{
                      width: rayW,
                      height: rayLen,
                      backgroundColor: "#FFD43B",
                      borderRadius: rayW / 2,
                    }}
                  />
                </View>
              ))}

              {/* Core circle */}
              <LinearGradient
                colors={["#FFE066", "#FFD43B", "#F5A623"]}
                style={{
                  width: coreR * 2, height: coreR * 2, borderRadius: coreR,
                  alignItems: "flex-start",
                }}
              >
                {/* Highlight */}
                <View
                  style={{
                    width: coreR * 0.4, height: coreR * 0.4,
                    borderRadius: coreR * 0.2,
                    backgroundColor: "rgba(255,255,255,0.35)",
                    margin: coreR * 0.2,
                  }}
                />
              </LinearGradient>
            </Animated.View>
          </LinearGradient>
        </LinearGradient>
      </Animated.View>
    </View>
  );
};

export default SunnyAvatar;
