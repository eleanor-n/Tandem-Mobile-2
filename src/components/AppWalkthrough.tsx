import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import SunnyAvatar from "./SunnyAvatar";
import { colors, radius, gradients } from "../theme";
import { LinearGradient } from "expo-linear-gradient";

const STORAGE_KEY = "walkthrough_complete";
const { width: W, height: H } = Dimensions.get("window");

// Bottom nav sits at bottom. 5 tabs, each W/5 wide.
// Tab order: Discover(0), Map(1), Post(2), Scrapbook(3), Profile(4)
const TAB_W = W / 5;
const NAV_H = 70; // approximate nav height incl padding

const tabCenterX = (index: number) => TAB_W * index + TAB_W / 2;
const NAV_TOP = H - NAV_H; // y where nav starts

type TooltipPosition = "above" | "below";

interface Step {
  message: string;
  // Highlight circle center
  highlightX: number;
  highlightY: number;
  highlightR: number;
  // Tooltip card positioning
  tooltipPosition: TooltipPosition;
  tooltipY: number;
  arrowLeft: number; // left offset of arrow tip within card
}

interface AppWalkthroughProps {
  // y position of the browse/my-activity toggle, measured via onLayout in DiscoverScreen
  toggleY?: number;
  insetTop?: number;
  onComplete: () => void;
}

export const AppWalkthrough = ({ toggleY = 120, insetTop = 0, onComplete }: AppWalkthroughProps) => {
  const [stepIndex, setStepIndex] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [stepIndex]);

  const STEPS: Step[] = [
    {
      message: "this is where the action is. browse what people want to do.",
      highlightX: tabCenterX(0),
      highlightY: NAV_TOP + 28,
      highlightR: 32,
      tooltipPosition: "above",
      tooltipY: NAV_TOP - 140,
      arrowLeft: tabCenterX(0) - 24,
    },
    {
      message: "browse to find tandems. my activity to manage yours.",
      highlightX: W / 2,
      highlightY: insetTop + 50,
      highlightR: 70,
      tooltipPosition: "below",
      tooltipY: insetTop + 100,
      arrowLeft: W / 2 - 24,
    },
    {
      message: "got something in mind? post it. someone will show up.",
      highlightX: tabCenterX(2),
      highlightY: NAV_TOP + 10,
      highlightR: 36,
      tooltipPosition: "above",
      tooltipY: NAV_TOP - 140,
      arrowLeft: tabCenterX(2) - 24,
    },
    {
      message: "see what's happening near you on the map.",
      highlightX: tabCenterX(1),
      highlightY: NAV_TOP + 28,
      highlightR: 32,
      tooltipPosition: "above",
      tooltipY: NAV_TOP - 140,
      arrowLeft: tabCenterX(1) - 24,
    },
    {
      message: "every tandem gets saved here. your adventures, catalogued.",
      highlightX: tabCenterX(3),
      highlightY: NAV_TOP + 28,
      highlightR: 32,
      tooltipPosition: "above",
      tooltipY: NAV_TOP - 140,
      arrowLeft: tabCenterX(3) - 24,
    },
    {
      message: "that's you. keep it interesting.",
      highlightX: tabCenterX(4),
      highlightY: NAV_TOP + 28,
      highlightR: 32,
      tooltipPosition: "above",
      tooltipY: NAV_TOP - 140,
      arrowLeft: tabCenterX(4) - 24,
    },
  ];

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  const advance = () => {
    opacity.setValue(0);
    if (isLast) {
      finish();
    } else {
      setStepIndex(i => i + 1);
    }
  };

  const finish = () => {
    onComplete();
  };

  // Clamp tooltip card to screen bounds
  const CARD_W = W - 48;
  const cardLeft = Math.max(16, Math.min(step.arrowLeft - CARD_W / 2 + 24, W - CARD_W - 16));
  const arrowOffsetWithinCard = step.highlightX - cardLeft - 12; // 12 = half arrow width
  const clampedArrow = Math.max(16, Math.min(arrowOffsetWithinCard, CARD_W - 40));

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 999 }]} pointerEvents="box-none">
      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
        {/* Dark overlay */}
        <Animated.View style={[StyleSheet.absoluteFillObject, s.overlay, { opacity }]} pointerEvents="none" />

        {/* Highlight ring */}
        <Animated.View
          pointerEvents="none"
          style={[
            s.highlight,
            {
              left: step.highlightX - step.highlightR,
              top: step.highlightY - step.highlightR,
              width: step.highlightR * 2,
              height: step.highlightR * 2,
              borderRadius: step.highlightR,
              opacity,
            },
          ]}
        />

        {/* Tooltip card */}
        <Animated.View
          style={[
            s.card,
            {
              left: cardLeft,
              top: step.tooltipY,
              opacity,
            },
          ]}
        >
          {/* Arrow */}
          {step.tooltipPosition === "above" && (
            <View style={[s.arrowDown, { left: clampedArrow }]} />
          )}

          <View style={s.cardContent}>
            <SunnyAvatar expression="warm" size={32} />
            <Text style={s.message}>{step.message}</Text>
          </View>

          {step.tooltipPosition === "below" && (
            <View style={[s.arrowUp, { left: clampedArrow }]} />
          )}

          <View style={s.actions}>
            <TouchableOpacity onPress={finish} activeOpacity={0.7}>
              <Text style={s.skip}>skip</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={advance} activeOpacity={0.85} style={s.nextBtn}>
              <LinearGradient
                colors={gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.nextBtnInner}
              >
                <Text style={s.nextBtnText}>{isLast ? "let's go →" : "next →"}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

export async function shouldShowWalkthrough(): Promise<boolean> {
  const val = await AsyncStorage.getItem(STORAGE_KEY);
  return !val;
}

const s = StyleSheet.create({
  overlay: {
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  highlight: {
    position: "absolute",
    borderWidth: 2.5,
    borderColor: colors.teal,
    backgroundColor: "rgba(45,212,191,0.12)",
  },
  card: {
    position: "absolute",
    width: W - 48,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.teal,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
    overflow: "visible",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  message: {
    flex: 1,
    fontSize: 14,
    color: colors.foreground,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 4,
  },
  skip: {
    fontSize: 13,
    color: colors.muted,
  },
  nextBtn: {
    borderRadius: radius.full,
    overflow: "hidden",
  },
  nextBtnInner: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.full,
  },
  nextBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  // Downward-pointing arrow (card is above target)
  arrowDown: {
    position: "absolute",
    bottom: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: colors.background,
  },
  // Upward-pointing arrow (card is below target)
  arrowUp: {
    position: "absolute",
    top: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: colors.background,
  },
});
