import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import SunnyAvatar from "../components/SunnyAvatar";
import { colors } from "../theme";

const { width: W, height: H } = Dimensions.get("window");

const PANELS = [
  {
    photo: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800",
    text: "never go alone.",
  },
  {
    photo: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800",
    text: "the activity is the icebreaker.",
  },
  {
    photo: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800",
    text: "the companion is the memory.",
  },
];

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

interface SplashAnimationScreenProps {
  onComplete: () => void;
}

export const SplashAnimationScreen = ({ onComplete }: SplashAnimationScreenProps) => {
  const [panelIndex, setPanelIndex] = useState(0);
  const [showSunny, setShowSunny] = useState(false);
  const panelOpacity = useRef(new Animated.Value(1)).current;
  const sunnyOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    runSequence();
  }, []);

  const crossfadeTo = (nextIndex: number): Promise<void> =>
    new Promise(resolve => {
      Animated.timing(panelOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setPanelIndex(nextIndex);
        Animated.timing(panelOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start(() => resolve());
      });
    });

  const runSequence = async () => {
    // Panel 0 visible on mount
    await delay(800);
    await crossfadeTo(1);
    await delay(800);
    await crossfadeTo(2);
    await delay(800);

    // Fade out panels, fade in Sunny
    await new Promise<void>(resolve => {
      Animated.timing(panelOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => resolve());
    });

    setShowSunny(true);
    Animated.timing(sunnyOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    await delay(1200);
    await AsyncStorage.setItem("splash_shown", "true");
    onComplete();
  };

  return (
    <View style={s.container}>
      {!showSunny ? (
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: panelOpacity }]}>
          <Image
            source={{ uri: PANELS[panelIndex].photo }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
          <View style={s.overlay} />
          <View style={s.textWrap}>
            <Text style={s.panelText}>{PANELS[panelIndex].text}</Text>
          </View>
        </Animated.View>
      ) : (
        <Animated.View style={[s.sunnyWrap, { opacity: sunnyOpacity }]}>
          <SunnyAvatar expression="warm" size={80} />
          <Text style={s.sunnyText}>let's find your people.</Text>
        </Animated.View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    width: W,
    height: H,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  textWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  panelText: {
    fontFamily: "Quicksand-Bold",
    fontSize: 28,
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  sunnyWrap: {
    alignItems: "center",
    gap: 20,
  },
  sunnyText: {
    fontFamily: "Quicksand-Bold",
    fontSize: 18,
    color: colors.foreground,
    textAlign: "center",
  },
});
