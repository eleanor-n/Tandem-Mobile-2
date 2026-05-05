import React from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, shadows, gradients } from "../../theme";

interface Props {
  visible: boolean;
  onChangeLocation: () => void;
  onKeepAsIs: () => void;
  onDismiss: () => void;
}

const PRIVATE_TYPES = ["premise", "subpremise", "street_address", "route"];
const PRIVATE_KEYWORDS = ["home", "house", "apt", "apartment", "room", "dorm"];

export function shouldNudgeLocation(place: any): boolean {
  if (!place) return false;

  const types: string[] = Array.isArray(place.types) ? place.types : [];
  if (types.some((t) => PRIVATE_TYPES.includes(t))) return true;

  const text = [
    place.fullText,
    place.description,
    place.primaryText,
    place.secondaryText,
    place.formattedAddress,
    typeof place === "string" ? place : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return PRIVATE_KEYWORDS.some((kw) => {
    const re = new RegExp(`\\b${kw}\\b`, "i");
    return re.test(text);
  });
}

export function PrivateLocationNudge({ visible, onChangeLocation, onKeepAsIs, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
      <Pressable style={[s.backdrop, { paddingBottom: insets.bottom + 16 }]} onPress={onDismiss}>
        <Pressable style={s.card} onPress={(e) => e.stopPropagation()}>
          <Text style={m.title}>
            heads up, first hangs tend to go smoother in public spots. totally your call though.
          </Text>

          <TouchableOpacity onPress={onKeepAsIs} activeOpacity={0.88} style={{ marginTop: 20 }}>
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.primaryBtn}
            >
              <Text style={s.primaryBtnText}>keep as is</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={onChangeLocation} activeOpacity={0.8} style={s.outlineBtn}>
            <Text style={s.outlineBtnText}>change location</Text>
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
  outlineBtn: {
    marginTop: 10,
    borderRadius: radius.full,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  outlineBtnText: {
    fontSize: 15,
    color: colors.secondary,
    fontFamily: "Quicksand_600SemiBold",
    fontWeight: "600",
  },
});

const m = StyleSheet.create({
  title: {
    fontFamily: "Caveat_700Bold",
    fontSize: 22,
    fontStyle: "italic",
    color: colors.foreground,
    textAlign: "center",
    lineHeight: 28,
  },
});
