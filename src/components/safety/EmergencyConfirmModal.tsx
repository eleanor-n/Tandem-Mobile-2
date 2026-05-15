// Two-step confirmation for the "need help" emergency flow.
// Backdrop tap = cancel (NOT confirm) so accidental taps can't trigger 911.

import React from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, shadows } from "../../theme";

interface Props {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function EmergencyConfirmModal({ visible, onCancel, onConfirm }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
    >
      <Pressable style={s.backdrop} onPress={onCancel}>
        <Pressable style={s.card} onPress={(e) => e.stopPropagation()}>
          <Text style={s.title}>Are you in an emergency?</Text>
          <Text style={s.body}>
            Tapping yes will call 911 and text your spot person. Only use this
            for real emergencies.
          </Text>

          <TouchableOpacity
            onPress={onCancel}
            activeOpacity={0.85}
            style={s.cancelBtn}
          >
            <Text style={s.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onConfirm}
            activeOpacity={0.88}
            style={s.confirmBtnWrap}
          >
            <LinearGradient
              colors={["#DC2626", "#B91C1C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.confirmBtn}
            >
              <Text style={s.confirmBtnText}>Yes, call 911</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    padding: 24,
    width: "100%",
    ...shadows.float,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Quicksand_700Bold",
    color: colors.foreground,
    textAlign: "center",
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: colors.secondary,
    fontFamily: "Quicksand_500Medium",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 22,
  },
  cancelBtn: {
    height: 50,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  cancelBtnText: {
    fontSize: 15,
    color: colors.foreground,
    fontFamily: "Quicksand_600SemiBold",
    fontWeight: "600",
  },
  confirmBtnWrap: {
    borderRadius: radius.full,
    overflow: "hidden",
  },
  confirmBtn: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: {
    fontSize: 15,
    color: colors.white,
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
  },
});
