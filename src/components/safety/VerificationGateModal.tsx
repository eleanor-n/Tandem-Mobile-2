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
  hasSelfieUploaded: boolean;
  onClose: () => void;
  onTakeSelfie?: () => void;
}

export function VerificationGateModal({ visible, hasSelfieUploaded, onClose, onTakeSelfie }: Props) {
  const insets = useSafeAreaInsets();

  const sunnyLine = hasSelfieUploaded
    ? "still verifying you, won't be long. you can browse around in the meantime."
    : "you haven't taken a verification selfie yet. tap below to do that now.";

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={[s.backdrop, { paddingBottom: insets.bottom + 16 }]} onPress={onClose}>
        <Pressable style={s.card} onPress={(e) => e.stopPropagation()}>
          <Text style={m.title}>{sunnyLine}</Text>

          {hasSelfieUploaded ? (
            <TouchableOpacity onPress={onClose} activeOpacity={0.88} style={{ marginTop: 20 }}>
              <LinearGradient
                colors={gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.primaryBtn}
              >
                <Text style={s.primaryBtnText}>got it</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => {
                onClose();
                onTakeSelfie?.();
              }}
              activeOpacity={0.88}
              style={{ marginTop: 20 }}
            >
              <LinearGradient
                colors={gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.primaryBtn}
              >
                <Text style={s.primaryBtnText}>take selfie</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
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
