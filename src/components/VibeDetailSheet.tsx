// Bottom-sheet modal opened when a user taps someone else's vibe in the
// VibingStrip. Inlines the avatar + vibe visuals (originally lived in the
// now-deleted VibingCard) and adds a sticky "say hey" / "i'm in" footer +
// ambient expiry timer.

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, shadows, gradients } from "../theme";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { TierAvatar } from "./safety/TierAvatar";
import type { VibeFeedItem } from "../lib/vibes";

interface Props {
  visible: boolean;
  vibe: VibeFeedItem | null;
  onClose: () => void;
  onOpenChat: (convo: { id: string; name: string; photo: string }) => void;
  onOpenProfile?: (userId: string) => void;
}

const VIBE_LABEL: Record<string, string> = {
  studying: "studying",
  coffeeing: "coffee'ing",
  eating: "eating",
  working_out: "working out",
  wandering: "wandering",
};

const VIBE_EMOJI: Record<string, string> = {
  studying: "📚",
  coffeeing: "☕",
  eating: "🍜",
  working_out: "💪",
  wandering: "🚶",
};

function calculateAge(birthday: string | null | undefined): number | null {
  if (!birthday) return null;
  return Math.floor(
    (Date.now() - new Date(birthday).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  );
}

function formatRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return r === 0 ? `${h}h` : `${h}h ${r}min`;
}

export function VibeDetailSheet({
  visible,
  vibe,
  onClose,
  onOpenChat,
  onOpenProfile,
}: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const screenH = Dimensions.get("window").height;
  const [busy, setBusy] = useState<null | "sayhey" | "imin">(null);
  const [remaining, setRemaining] = useState<string>("");

  useEffect(() => {
    if (!visible || !vibe) return;
    const tick = () => {
      const ms = new Date(vibe.expires_at).getTime() - Date.now();
      if (ms <= 0) {
        onClose();
        return;
      }
      setRemaining(formatRemaining(vibe.expires_at));
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [visible, vibe, onClose]);

  if (!vibe) return null;

  const label = VIBE_LABEL[vibe.vibe_preset] ?? vibe.vibe_preset.replace("_", " ");
  const emoji = vibe.emoji ?? VIBE_EMOJI[vibe.vibe_preset] ?? "✨";
  const age = calculateAge(vibe.user_birthday);

  // 1:1 chat reuse: a tandems row with activity_id=null acts as a DM thread.
  const ensureConvo = async (): Promise<string | null> => {
    if (!user) return null;
    const [a, b] = [user.id, vibe.user_id].sort();
    const { data: existing } = await supabase
      .from("tandems")
      .select("id")
      .is("activity_id", null)
      .eq("user_a_id", a)
      .eq("user_b_id", b)
      .maybeSingle();
    if ((existing as any)?.id) return (existing as any).id as string;
    const { data: created, error } = await supabase
      .from("tandems")
      .insert({ user_a_id: a, user_b_id: b, activity_id: null } as any)
      .select("id")
      .single();
    if (error) {
      console.warn("[VibeDetailSheet] convo create failed:", error.message);
      return null;
    }
    return (created as any).id as string;
  };

  const handleSayHey = async () => {
    if (busy || !user) return;
    setBusy("sayhey");
    try {
      const convoId = await ensureConvo();
      if (!convoId) return;
      onClose();
      onOpenChat({
        id: convoId,
        name: vibe.user_first_name ?? "them",
        photo: vibe.user_avatar_url ?? "",
      });
    } finally {
      setBusy(null);
    }
  };

  const handleImIn = async () => {
    if (busy || !user) return;
    setBusy("imin");
    try {
      const convoId = await ensureConvo();
      if (!convoId) return;
      const viewerName =
        (user.user_metadata?.first_name as string | undefined) ?? "someone";
      await supabase.from("messages").insert({
        tandem_id: convoId,
        sender_id: user.id,
        content: `${viewerName} is in for your vibe.`,
        system_kind: "vibe_join",
      } as any);
      try {
        await supabase.functions.invoke("notify-vibe-join", {
          body: {
            vibe_user_id: vibe.user_id,
            joiner_name: viewerName,
            tandem_id: convoId,
          },
        });
      } catch (err) {
        console.warn("[VibeDetailSheet] notify failed (non-blocking):", err);
      }
      onClose();
      onOpenChat({
        id: convoId,
        name: vibe.user_first_name ?? "them",
        photo: vibe.user_avatar_url ?? "",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable
          style={[s.sheet, { height: screenH * 0.5 }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={s.handle} />
          <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={10}>
            <Ionicons name="close" size={20} color={colors.muted} />
          </TouchableOpacity>

          <View style={s.content}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => onOpenProfile?.(vibe.user_id)}
            >
              <TierAvatar
                uri={vibe.user_avatar_url ?? undefined}
                size={88}
                tier={vibe.user_trust_tier ?? "new"}
                fallback={
                  <Text style={s.avatarFallback}>
                    {(vibe.user_first_name ?? "?").charAt(0).toUpperCase()}
                  </Text>
                }
              />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => onOpenProfile?.(vibe.user_id)}
            >
              <View style={s.nameRow}>
                <Text style={s.name}>{vibe.user_first_name ?? "someone"}</Text>
                {age != null ? <Text style={s.nameMeta}>{age}</Text> : null}
              </View>
            </TouchableOpacity>

            <View style={s.vibeRow}>
              <Text style={s.vibeLabel}>{label}</Text>
              <Text style={s.vibeEmoji}>{emoji}</Text>
            </View>

            <Text style={s.locationLine}>
              {vibe.location_label ? `📍 ${vibe.location_label} · ` : ""}
              {remaining} left
            </Text>

            <Text style={s.expiresLine}>vibing expires in {remaining}</Text>
          </View>

          <View
            style={[
              s.footer,
              { paddingBottom: Math.max(insets.bottom, 14) + 14 },
            ]}
          >
            <TouchableOpacity
              style={s.sayHeyBtn}
              onPress={handleSayHey}
              disabled={busy !== null}
              activeOpacity={0.85}
            >
              {busy === "sayhey" ? (
                <ActivityIndicator color={colors.foreground} size="small" />
              ) : (
                <Text style={s.sayHeyText}>say hey</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={s.imInBtnWrap}
              onPress={handleImIn}
              disabled={busy !== null}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.imInBtn}
              >
                {busy === "imin" ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={s.imInText}>i'm in</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
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
    paddingHorizontal: 24,
    paddingTop: 10,
    ...shadows.float,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 14,
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 16,
    padding: 4,
  },
  content: {
    flex: 1,
    alignItems: "center",
    gap: 10,
    paddingTop: 6,
  },
  avatarFallback: {
    fontSize: 30,
    color: colors.teal,
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginTop: 6,
  },
  name: {
    fontSize: 22,
    color: colors.foreground,
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
  },
  nameMeta: {
    fontSize: 14,
    color: colors.foreground,
    fontFamily: "Quicksand_500Medium",
  },
  vibeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  vibeLabel: {
    fontSize: 17,
    color: colors.foreground,
    fontFamily: "Quicksand_500Medium",
    fontWeight: "500",
  },
  vibeEmoji: {
    fontSize: 22,
    fontFamily: "System",
  },
  locationLine: {
    fontSize: 13,
    color: colors.muted,
    fontStyle: "italic",
    fontFamily: "Quicksand_500Medium",
  },
  expiresLine: {
    fontSize: 12,
    color: colors.muted,
    fontStyle: "italic",
    fontFamily: "Fraunces_500Medium_Italic",
    marginTop: 4,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sayHeyBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.foreground,
    alignItems: "center",
  },
  sayHeyText: {
    fontSize: 14,
    color: colors.foreground,
    fontFamily: "Quicksand_500Medium",
    fontWeight: "500",
  },
  imInBtnWrap: {
    flex: 1,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  imInBtn: {
    paddingVertical: 14,
    alignItems: "center",
  },
  imInText: {
    fontSize: 14,
    color: colors.white,
    fontFamily: "Quicksand_500Medium",
    fontWeight: "500",
  },
});
