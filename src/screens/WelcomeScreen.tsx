import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Image,
  Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { TandemLogo } from "../components/TandemLogo";
import { colors, radius, gradients } from "../theme";

const { width: W } = Dimensions.get("window");

const POLAROIDS = [
  {
    uri: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&h=500&fit=crop",
    caption: "hiking with strangers",
    rotate: "-8deg",
    translateX: -W * 0.12,
    translateY: 12,
    zIndex: 1,
  },
  {
    uri: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=400&h=500&fit=crop",
    caption: "saturday market run",
    rotate: "5deg",
    translateX: W * 0.1,
    translateY: -8,
    zIndex: 2,
  },
  {
    uri: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=500&fit=crop",
    caption: "coffee crawl vibes",
    rotate: "0deg",
    translateX: 0,
    translateY: 0,
    zIndex: 3,
  },
];

interface WelcomeScreenProps {
  onGetStarted: () => void;
  onSignIn: () => void;
  onGoogleSignIn: () => void;
}

export const WelcomeScreen = ({
  onGetStarted,
  onSignIn,
}: WelcomeScreenProps) => {
  const insets = useSafeAreaInsets();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, delay: 100, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, delay: 100, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleSignUp = async () => {
    try {
      await AsyncStorage.setItem("hasOnboarded", "true");
    } catch {}
    onGetStarted();
  };

  return (
    <View style={[s.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Logo top-left */}
      <View style={s.logoRow}>
        <TandemLogo size="sm" showWordmark />
      </View>

      {/* Polaroid stack */}
      <View style={s.polaroidStack}>
        {POLAROIDS.map((p, i) => (
          <View
            key={i}
            style={[
              s.polaroid,
              {
                transform: [
                  { rotate: p.rotate },
                  { translateX: p.translateX },
                  { translateY: p.translateY },
                ],
                zIndex: p.zIndex,
              },
            ]}
          >
            <Image source={{ uri: p.uri }} style={s.polaroidPhoto} resizeMode="cover" />
            <View style={s.polaroidCaption}>
              <Text style={s.polaroidText}>{p.caption}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Hero + CTA */}
      <Animated.View
        style={[
          s.bottom,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <Text style={s.hero}>Never Go{"\n"}Alone.</Text>
        <Text style={s.sub}>
          find your people. every{" "}
          <Text style={s.subTeal}>icebreaker</Text>
          {", handled."}
        </Text>

        <TouchableOpacity
          style={s.ctaWrapper}
          activeOpacity={0.88}
          onPress={handleSignUp}
        >
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.ctaGradient}
          >
            <Text style={s.ctaText}>sign up  →</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={onSignIn} activeOpacity={0.7} style={s.signInLink}>
          <Text style={s.signInText}>
            already have an account?{"  "}
            <Text style={s.signInBold}>sign in</Text>
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const POLAROID_W = W * 0.55;

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F0E8",
    paddingHorizontal: 28,
  },
  logoRow: {
    marginTop: 8,
    marginBottom: 0,
  },
  polaroidStack: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  polaroid: {
    position: "absolute",
    width: POLAROID_W,
    backgroundColor: "#FFFEF8",
    borderRadius: 3,
    shadowColor: "#5C3D1A",
    shadowOffset: { width: 3, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 12,
  },
  polaroidPhoto: {
    width: "100%",
    aspectRatio: 0.85,
    backgroundColor: "#DDD0B8",
  },
  polaroidCaption: {
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  polaroidText: {
    fontSize: 12,
    color: "#5C4A32",
    fontStyle: "italic",
    letterSpacing: 0.2,
  },
  bottom: {
    paddingBottom: 16,
    gap: 14,
  },
  hero: {
    fontSize: 52,
    fontWeight: "800",
    color: "#1C1410",
    letterSpacing: -2,
    lineHeight: 56,
  },
  sub: {
    fontSize: 16,
    color: "#8B7355",
    lineHeight: 24,
    fontWeight: "500",
  },
  subTeal: {
    color: colors.teal,
    fontWeight: "700",
  },
  ctaWrapper: {
    height: 56,
    borderRadius: radius.full,
    overflow: "hidden",
    marginTop: 4,
    shadowColor: colors.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.white,
    letterSpacing: 0.2,
  },
  signInLink: {
    alignItems: "center",
    paddingVertical: 4,
  },
  signInText: {
    fontSize: 14,
    color: "#A08060",
    fontWeight: "500",
  },
  signInBold: {
    color: colors.teal,
    fontWeight: "700",
  },
});
