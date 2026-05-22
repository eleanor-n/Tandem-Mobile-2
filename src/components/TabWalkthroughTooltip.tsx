// Per-tab one-time Sunny tooltip. Shown the first time a user lands on a
// given tab post-onboarding; dismissed forever via AsyncStorage.

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, radius, shadows } from "../theme";
import SunnyAvatar from "./SunnyAvatar";

export type TabWalkthroughKey =
  | "walkthrough_discover_seen"
  | "walkthrough_map_seen"
  | "walkthrough_center_button_seen"
  | "walkthrough_chat_seen"
  | "walkthrough_profile_seen";

interface Props {
  storageKey: TabWalkthroughKey;
  message: string;
  // Where the tooltip points. Currently we just float it; the spec asks for
  // tooltip-style overlays so this prop reserves the call site for future
  // pointer arrows without changing the API.
  anchor?: "top" | "bottom-center" | "bottom-right";
  // Controls when the tooltip is allowed to evaluate "should I show?" —
  // typically the activeTab matching the storageKey.
  active: boolean;
}

export function TabWalkthroughTooltip({
  storageKey,
  message,
  anchor = "bottom-center",
  active,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) return;
    AsyncStorage.getItem(storageKey).then((seen) => {
      if (!seen) setVisible(true);
    });
  }, [active, storageKey]);

  const dismiss = () => {
    setVisible(false);
    AsyncStorage.setItem(storageKey, "1").catch(() => { /* non-blocking */ });
  };

  if (!visible) return null;

  const anchorStyle =
    anchor === "top"
      ? s.anchorTop
      : anchor === "bottom-right"
        ? s.anchorBottomRight
        : s.anchorBottomCenter;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={dismiss}>
      <Pressable style={s.backdrop} onPress={dismiss}>
        <Pressable style={[s.tooltipWrap, anchorStyle]} onPress={(e) => e.stopPropagation()}>
          <View style={s.row}>
            <SunnyAvatar expression="warm" size={32} />
            <Text style={s.message}>{message}</Text>
          </View>
          <TouchableOpacity onPress={dismiss} activeOpacity={0.7} style={s.gotItBtn}>
            <Text style={s.gotItText}>got it</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  tooltipWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: 16,
    ...shadows.float,
  },
  anchorTop: { top: 80 },
  anchorBottomCenter: { bottom: 110 },
  anchorBottomRight: { bottom: 110 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontStyle: "italic",
    fontFamily: "Fraunces_500Medium_Italic",
    color: colors.foreground,
    lineHeight: 20,
  },
  gotItBtn: {
    alignSelf: "flex-end",
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 8,
  },
  gotItText: {
    fontSize: 13,
    color: colors.teal,
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
  },
});
