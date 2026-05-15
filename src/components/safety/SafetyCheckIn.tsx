import React, { useState } from "react";
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
import { supabase } from "../../lib/supabase";

interface Props {
  visible: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  // Required for saving the response. If absent, the component still renders
  // but doesn't persist (graceful degradation).
  tandemId?: string;
  userId?: string;
  // Legacy/optional props from prior callsites — left here so existing
  // usages don't break.
  activityTitle?: string;
  location?: string;
  dateTime?: string;
  posterFirstName?: string;
  posterId?: string;
}

type Response = "all_good" | "fine" | "not_great";

export function SafetyCheckIn({
  visible,
  onConfirm,
  onDismiss,
  tandemId,
  userId,
}: Props) {
  const insets = useSafeAreaInsets();
  const [submitting, setSubmitting] = useState<Response | null>(null);

  const handleRespond = async (value: Response) => {
    if (submitting) return;
    setSubmitting(value);
    try {
      if (tandemId && userId) {
        await supabase
          .from("safety_checkins")
          .insert({ user_id: userId, tandem_id: tandemId, response_value: value } as any);
      }
      // Demotion signal: trigger tier recompute on not_great.
      if (value === "not_great" && userId) {
        try {
          await supabase.functions.invoke("update-trust-tier", {
            body: { user_id: userId, trigger: "checkin" },
          });
        } catch { /* non-blocking */ }
      }
    } catch (err) {
      console.warn("[SafetyCheckIn] save failed:", err);
    } finally {
      setSubmitting(null);
      onConfirm();
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
      <Pressable style={[s.backdrop, { paddingBottom: insets.bottom + 16 }]} onPress={onDismiss}>
        <Pressable style={s.card} onPress={(e) => e.stopPropagation()}>
          <Text style={m.title}>how'd it go?</Text>

          <TouchableOpacity
            onPress={() => handleRespond("all_good")}
            disabled={submitting !== null}
            activeOpacity={0.88}
            style={{ marginTop: 20 }}
          >
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.primaryBtn}
            >
              <Text style={s.primaryBtnText}>All good</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleRespond("fine")}
            disabled={submitting !== null}
            activeOpacity={0.85}
            style={s.outlineBtn}
          >
            <Text style={s.outlineBtnText}>Fine</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleRespond("not_great")}
            disabled={submitting !== null}
            activeOpacity={0.85}
            style={s.outlineWarnBtn}
          >
            <Text style={s.outlineWarnBtnText}>Not great</Text>
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
  outlineWarnBtn: {
    marginTop: 10,
    borderRadius: radius.full,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#F59E0B",
    backgroundColor: "#FFFBEB",
  },
  outlineWarnBtnText: {
    fontSize: 15,
    color: "#B45309",
    fontFamily: "Quicksand_600SemiBold",
    fontWeight: "600",
  },
});

const m = StyleSheet.create({
  title: {
    fontFamily: "Fraunces_500Medium_Italic",
    fontSize: 24,
    fontStyle: "italic",
    color: colors.foreground,
    textAlign: "center",
    lineHeight: 30,
  },
});
