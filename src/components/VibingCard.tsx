// Compact ambient-vibe card rendered inline with tandem posts in Discover.
// Lower friction than a formal post: "say hey" opens a chat, "i'm in" opens
// the chat AND drops a Sunny system message announcing the join.

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadows, gradients } from "../theme";
import { TierAvatar } from "./safety/TierAvatar";
import type { TrustTier } from "../lib/trustService";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export interface VibeFeedItem {
  id: string;
  user_id: string;
  vibe_preset: string;
  emoji: string | null;
  duration_minutes: number;
  audience: string;
  current_lat: number;
  current_lng: number;
  location_label: string | null;
  expires_at: string;
  created_at: string;
  // Joined from profiles
  user_first_name?: string | null;
  user_avatar_url?: string | null;
  user_trust_tier?: TrustTier;
  user_birthday?: string | null;
}

interface Props {
  vibe: VibeFeedItem;
  onOpenChat: (convo: { id: string; name: string; photo: string }) => void;
  onOpenProfile?: (userId: string) => void;
  onExpired?: (vibeId: string) => void;
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
  if (mins < 60) return `${mins} min left`;
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return r === 0 ? `${h}h left` : `${h}h ${r}min left`;
}

export function VibingCard({ vibe, onOpenChat, onOpenProfile, onExpired }: Props) {
  const { user } = useAuth();
  const [remaining, setRemaining] = useState<string>(() => formatRemaining(vibe.expires_at));
  const [busy, setBusy] = useState<null | "sayhey" | "imin">(null);

  useEffect(() => {
    const tick = () => {
      const ms = new Date(vibe.expires_at).getTime() - Date.now();
      if (ms <= 0) {
        onExpired?.(vibe.id);
        return;
      }
      setRemaining(formatRemaining(vibe.expires_at));
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [vibe.expires_at, vibe.id, onExpired]);

  // Ensure a 1:1 conversation row exists between viewer and vibe-user, and
  // return the tandem_id we can use to open the chat. We reuse the existing
  // tandems table for 1:1 threads; activity_id is null for ambient vibes.
  const ensureConvo = async (): Promise<string | null> => {
    if (!user) return null;
    // Sort the two user IDs so a stable pair never produces duplicate rows.
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
      console.warn("[VibingCard] convo create failed:", error.message);
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

      // Drop a Sunny system message in the chat announcing the join.
      const viewerName = (user.user_metadata?.first_name as string | undefined) ?? "someone";
      await supabase.from("messages").insert({
        tandem_id: convoId,
        sender_id: user.id,
        content: `${viewerName} is in for your vibe.`,
        system_kind: "vibe_join",
      } as any);

      // Fire push to the vibe-user via the dedicated edge function. Falls back
      // gracefully if the function isn't deployed yet.
      try {
        await supabase.functions.invoke("notify-vibe-join", {
          body: {
            vibe_user_id: vibe.user_id,
            joiner_name: viewerName,
            tandem_id: convoId,
          },
        });
      } catch (err) {
        console.warn("[VibingCard] notify-vibe-join failed (non-blocking):", err);
      }

      onOpenChat({
        id: convoId,
        name: vibe.user_first_name ?? "them",
        photo: vibe.user_avatar_url ?? "",
      });
    } finally {
      setBusy(null);
    }
  };

  const label = VIBE_LABEL[vibe.vibe_preset] ?? vibe.vibe_preset.replace("_", " ");
  const emoji = vibe.emoji ?? VIBE_EMOJI[vibe.vibe_preset] ?? "✨";
  const age = calculateAge(vibe.user_birthday);

  return (
    <View style={s.card}>
      <Text style={s.vibingTag}>vibing</Text>

      <View style={s.contentRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => onOpenProfile?.(vibe.user_id)}
        >
          <TierAvatar
            uri={vibe.user_avatar_url ?? undefined}
            size={48}
            tier={vibe.user_trust_tier ?? "new"}
            fallback={
              <Text style={s.avatarFallback}>
                {(vibe.user_first_name ?? "?").charAt(0).toUpperCase()}
              </Text>
            }
          />
        </TouchableOpacity>

        <View style={s.identityCol}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onOpenProfile?.(vibe.user_id)}
          >
            <View style={s.nameRow}>
              <Text style={s.name}>{vibe.user_first_name ?? "someone"}</Text>
              {age != null ? <Text style={s.nameMeta}>{age}</Text> : null}
            </View>
          </TouchableOpacity>
          <View style={s.vibeLine}>
            <Text style={s.vibeLabel}>{label}</Text>
            <Text style={s.vibeEmoji}>{emoji}</Text>
          </View>
          <Text style={s.locationLine}>
            {vibe.location_label ? `📍 ${vibe.location_label} · ` : ""}
            {remaining}
          </Text>
        </View>
      </View>

      <View style={s.actionRow}>
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
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: "#F6FBFA",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.teal + "33",
    borderRadius: 16,
    padding: 14,
    ...shadows.card,
  },
  vibingTag: {
    position: "absolute",
    top: 10,
    right: 14,
    fontSize: 10,
    fontStyle: "italic",
    fontFamily: "Fraunces_500Medium_Italic",
    color: colors.teal,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarFallback: {
    fontSize: 18,
    color: colors.teal,
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
  },
  identityCol: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  name: {
    fontSize: 15,
    color: colors.foreground,
    fontFamily: "Quicksand_500Medium",
    fontWeight: "500",
  },
  nameMeta: {
    fontSize: 12,
    color: colors.foreground,
    fontFamily: "Quicksand_500Medium",
  },
  vibeLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  vibeLabel: {
    fontSize: 14,
    color: colors.foreground,
    fontFamily: "Quicksand_500Medium",
  },
  vibeEmoji: {
    fontSize: 16,
    fontFamily: "System",
  },
  locationLine: {
    fontSize: 12,
    color: colors.muted,
    fontStyle: "italic",
    fontFamily: "Quicksand_500Medium",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  sayHeyBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.foreground,
    alignItems: "center",
  },
  sayHeyText: {
    fontSize: 12,
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
    paddingVertical: 8,
    alignItems: "center",
  },
  imInText: {
    fontSize: 12,
    color: colors.white,
    fontFamily: "Quicksand_500Medium",
    fontWeight: "500",
  },
});
