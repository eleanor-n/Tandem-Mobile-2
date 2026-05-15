// Reusable report-user modal.
// Opened from RequestSheet, ChatScreen, ProfileScreen, or anywhere a viewer
// might want to flag another user.
//
// On submit: inserts a row in user_reports, then explicitly invokes the
// update-trust-tier edge function with trigger="report" so demotion/suspension
// logic can run without waiting on a DB trigger.

import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, shadows } from "../../theme";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

interface Props {
  visible: boolean;
  reportedUserId: string;
  reportedUserName?: string;
  // Optional context to attach
  activityId?: string;
  tandemId?: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

const REASONS = [
  { key: "harassment", label: "harassment or aggression" },
  { key: "unsafe", label: "felt unsafe in person" },
  { key: "no_show", label: "didn't show up" },
  { key: "inappropriate", label: "inappropriate behavior" },
  { key: "fake_profile", label: "fake or misleading profile" },
  { key: "dating_vibes", label: "treating tandem like a dating app" },
  { key: "other", label: "something else" },
];

export function ReportUserModal({
  visible,
  reportedUserId,
  reportedUserName,
  activityId,
  tandemId,
  onClose,
  onSubmitted,
}: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setSelected(null);
    setDetails("");
    setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selected || !user || submitting) return;
    setSubmitting(true);
    try {
      await supabase.from("user_reports").insert({
        reporter_id: user.id,
        reported_user_id: reportedUserId,
        activity_id: activityId ?? null,
        tandem_id: tandemId ?? null,
        reason: selected,
        details: details.trim() || null,
      } as any);

      // Explicit invocation so demotion/suspension runs immediately.
      try {
        await supabase.functions.invoke("update-trust-tier", {
          body: { user_id: reportedUserId, trigger: "report" },
        });
      } catch (err) {
        console.warn("[ReportUserModal] tier update invoke failed:", err);
      }

      onSubmitted?.();
      reset();
      onClose();
    } catch (err: any) {
      console.warn("[ReportUserModal] insert failed:", err);
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={s.backdrop} onPress={handleClose}>
        <Pressable
          style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 18) + 12 }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={s.handle} />
          <View style={s.headerRow}>
            <Text style={s.title}>
              report {reportedUserName ?? "this user"}
            </Text>
            <TouchableOpacity onPress={handleClose} hitSlop={10}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <Text style={s.sub}>
            we read every report. thanks for keeping tandem safe.
          </Text>

          <Text style={s.label}>what happened?</Text>
          <View style={s.reasonGrid}>
            {REASONS.map((r) => (
              <TouchableOpacity
                key={r.key}
                style={[s.chip, selected === r.key && s.chipSelected]}
                onPress={() => setSelected(r.key)}
                activeOpacity={0.85}
              >
                <Text
                  style={[s.chipText, selected === r.key && s.chipTextSelected]}
                >
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>anything else? (optional)</Text>
          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder="share more so we can act on this"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={500}
            style={s.input}
          />

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!selected || submitting}
            activeOpacity={0.88}
            style={[s.submitBtn, (!selected || submitting) && s.submitBtnDisabled]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={s.submitBtnText}>submit report</Text>
            )}
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
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    ...shadows.float,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Quicksand_700Bold",
    color: colors.foreground,
  },
  sub: {
    marginTop: 4,
    marginBottom: 18,
    fontSize: 13,
    color: colors.muted,
    fontFamily: "Quicksand_500Medium",
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Quicksand_700Bold",
    color: colors.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 8,
  },
  reasonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipSelected: {
    borderColor: colors.teal,
    backgroundColor: colors.tintTeal,
  },
  chipText: {
    fontSize: 13,
    color: colors.secondary,
    fontFamily: "Quicksand_500Medium",
  },
  chipTextSelected: {
    color: colors.foreground,
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.foreground,
    fontFamily: "Quicksand_500Medium",
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 18,
  },
  submitBtn: {
    backgroundColor: colors.destructive,
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: {
    fontSize: 15,
    color: colors.white,
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
  },
});
