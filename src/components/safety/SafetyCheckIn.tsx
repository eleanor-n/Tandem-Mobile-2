import React from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  Share,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, shadows, gradients } from "../../theme";

interface Props {
  visible: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  activityTitle: string;
  location: string;
  dateTime: string;
  posterFirstName: string;
  posterId: string;
}

export function SafetyCheckIn({
  visible,
  onConfirm,
  onDismiss,
  activityTitle,
  location,
  dateTime,
  posterFirstName,
  posterId,
}: Props) {
  const insets = useSafeAreaInsets();

  const handleSendDetails = async () => {
    const message = `hey! i'm heading out to ${activityTitle} at ${location} on ${dateTime} with ${posterFirstName} from tandem. here's their profile: tandem://profile/${posterId}. i'll text you when i'm home.`;
    try {
      await Share.share({ message });
    } catch {
      // ignore — onConfirm runs regardless
    }
    onConfirm();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
      <Pressable style={[s.backdrop, { paddingBottom: insets.bottom + 16 }]} onPress={onDismiss}>
        <Pressable style={s.card} onPress={(e) => e.stopPropagation()}>
          <Text style={m.title}>want me to let a friend know where you're headed?</Text>

          <TouchableOpacity onPress={handleSendDetails} activeOpacity={0.88} style={{ marginTop: 20 }}>
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.primaryBtn}
            >
              <Text style={s.primaryBtnText}>yes, send the details</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={onConfirm} activeOpacity={0.8} style={s.skipBtn}>
            <Text style={s.skipBtnText}>skip</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    padding: 24,
    width: "100%",
    ...shadows.card,
  },
  primaryBtn: {
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: {
    fontSize: 15,
    color: colors.white,
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
  },
  skipBtn: {
    marginTop: 10,
    borderRadius: radius.full,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  skipBtnText: {
    fontSize: 15,
    color: colors.secondary,
    fontFamily: "Quicksand_600SemiBold",
    fontWeight: "600",
  },
});

const m = StyleSheet.create({
  title: {
    fontFamily: "Caveat_700Bold",
    fontSize: 24,
    fontStyle: "italic",
    color: colors.foreground,
    textAlign: "center",
    lineHeight: 30,
  },
});
