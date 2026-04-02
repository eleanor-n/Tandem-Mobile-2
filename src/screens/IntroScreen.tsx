import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface IntroScreenProps {
  onDone: () => void;
}

const SLIDES = [
  { key: "tagline",    type: "tagline" },
  { key: "icebreaker", type: "icebreaker" },
  { key: "memory",     type: "memory" },
];

const DISPLAY_MS = 2800;
const FADE_MS = 500;

export const IntroScreen = ({ onDone }: IntroScreenProps) => {
  const insets = useSafeAreaInsets();
  const [currentSlide, setCurrentSlide] = useState(0);
  const slideOpacity = useRef(new Animated.Value(1)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AsyncStorage.setItem("hasSeenIntro", "true");
    advanceFrom(0);
  }, []);

  const advanceFrom = (index: number) => {
    if (index >= SLIDES.length) {
      // Fade out entire screen then call onDone
      Animated.timing(screenOpacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => {
        onDone();
      });
      return;
    }

    const holdTimer = setTimeout(() => {
      if (index === SLIDES.length - 1) {
        // Last slide — fade out screen
        Animated.timing(screenOpacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => {
          onDone();
        });
      } else {
        // Fade out current slide
        Animated.timing(slideOpacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => {
          setCurrentSlide(index + 1);
          slideOpacity.setValue(0);
          Animated.timing(slideOpacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start(() => {
            advanceFrom(index + 1);
          });
        });
      }
    }, DISPLAY_MS);

    return () => clearTimeout(holdTimer);
  };

  const slide = SLIDES[currentSlide];

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: screenOpacity }]}>
      <LinearGradient
        colors={["#2DD4BF", "#3B82F6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
      >
        <Animated.View style={[s.slideContent, { opacity: slideOpacity }]}>
          {slide.type === "tagline" && (
            <>
              <Text style={s.taglineText}>Never Go Alone.</Text>
            </>
          )}
          {slide.type === "icebreaker" && (
            <>
              <Text style={{ fontFamily: "System", fontSize: 32, marginBottom: 16 }}>☀️</Text>
              <Text style={s.bodyText}>The activity is the icebreaker.</Text>
            </>
          )}
          {slide.type === "memory" && (
            <>
              <Text style={{ fontFamily: "System", fontSize: 32, marginBottom: 16 }}>🫶</Text>
              <Text style={s.bodyText}>The companion makes the memory.</Text>
            </>
          )}
        </Animated.View>

        {/* Dot indicators */}
        <View style={[s.dots, { bottom: insets.bottom + 40 }]}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[s.dot, { opacity: i === currentSlide ? 1 : 0.4 }]}
            />
          ))}
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  slideContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  taglineText: {
    fontSize: 48,
    fontWeight: "800",
    color: "white",
    letterSpacing: -2,
    textAlign: "center",
  },
  bodyText: {
    fontSize: 28,
    fontWeight: "700",
    color: "white",
    textAlign: "center",
    lineHeight: 36,
  },
  dots: {
    position: "absolute",
    flexDirection: "row",
    gap: 8,
    alignSelf: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "white",
  },
});
