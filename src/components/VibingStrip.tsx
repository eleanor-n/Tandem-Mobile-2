// Instagram Stories-style horizontal strip of active vibes, rendered at
// the top of DiscoverScreen above the main tandem feed. First slot is
// always the viewer's own "start vibing" / "your vibe" action.

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "../theme";
import { TierAvatar } from "./safety/TierAvatar";
import type { VibeFeedItem } from "../lib/vibes";

interface Props {
  vibes: VibeFeedItem[];
  // Whether the viewer has an active vibe of their own. If true, the first
  // slot becomes "your vibe" with a pause badge; otherwise it's "+ start vibing".
  viewerHasActiveVibe: boolean;
  viewerFirstName?: string | null;
  viewerAvatarUrl?: string | null;
  viewerTrustTier?: "new" | "known" | "trusted";
  onPressStart: () => void;
  onPressOwnVibe: () => void;
  onPressOtherVibe: (vibe: VibeFeedItem) => void;
}

const VIBE_EMOJI: Record<string, string> = {
  studying: "📚",
  coffeeing: "☕",
  eating: "🍜",
  working_out: "💪",
  wandering: "🚶",
};

const MAX_ENTRIES = 20;

export function VibingStrip({
  vibes,
  viewerHasActiveVibe,
  viewerFirstName,
  viewerAvatarUrl,
  viewerTrustTier,
  onPressStart,
  onPressOwnVibe,
  onPressOtherVibe,
}: Props) {
  // Tick every 60s to drop expired vibes locally without waiting on refetch.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const liveVibes = useMemo(() => {
    const now = Date.now();
    return vibes
      .filter((v) => new Date(v.expires_at).getTime() > now)
      .slice(0, MAX_ENTRIES);
    // tick included so useMemo recomputes when the timer fires
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vibes, tick]);

  const showEmptyHint = liveVibes.length === 0;

  return (
    <View style={s.container}>
      <Text style={s.label}>vibing right now</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.row}
      >
        {/* First slot — viewer action */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={viewerHasActiveVibe ? onPressOwnVibe : onPressStart}
          style={s.item}
        >
          {viewerHasActiveVibe ? (
            <View style={s.avatarWrap}>
              <TierAvatar
                uri={viewerAvatarUrl ?? undefined}
                size={64}
                tier={viewerTrustTier ?? "new"}
                fallback={
                  <Text style={s.avatarFallback}>
                    {(viewerFirstName ?? "?").charAt(0).toUpperCase()}
                  </Text>
                }
              />
              <View style={s.badgePause}>
                <Ionicons name="pause" size={12} color={colors.foreground} />
              </View>
            </View>
          ) : (
            <View style={s.startCircle}>
              <Ionicons name="add" size={32} color={colors.white} />
            </View>
          )}
          <Text style={s.itemLabel} numberOfLines={1}>
            {viewerHasActiveVibe ? "your vibe" : "start vibing"}
          </Text>
        </TouchableOpacity>

        {/* Empty-state hint when no one else is vibing */}
        {showEmptyHint ? (
          <View style={s.emptyHintWrap}>
            <Text style={s.emptyHint}>be the first to vibe today.</Text>
          </View>
        ) : (
          liveVibes.map((v) => {
            const emoji = v.emoji ?? VIBE_EMOJI[v.vibe_preset] ?? "✨";
            return (
              <TouchableOpacity
                key={v.id}
                activeOpacity={0.85}
                onPress={() => onPressOtherVibe(v)}
                style={s.item}
              >
                <View style={s.avatarWrap}>
                  <TierAvatar
                    uri={v.user_avatar_url ?? undefined}
                    size={64}
                    tier={v.user_trust_tier ?? "new"}
                    fallback={
                      <Text style={s.avatarFallback}>
                        {(v.user_first_name ?? "?").charAt(0).toUpperCase()}
                      </Text>
                    }
                  />
                  <View style={s.badgeEmoji}>
                    <Text style={s.badgeEmojiText}>{emoji}</Text>
                  </View>
                </View>
                <Text style={s.itemLabel} numberOfLines={1}>
                  {v.user_first_name ?? "someone"}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  label: {
    fontSize: 12,
    fontStyle: "italic",
    fontFamily: "Fraunces_500Medium_Italic",
    color: colors.teal,
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingRight: 4,
  },
  item: {
    width: 70,
    alignItems: "center",
    gap: 6,
  },
  avatarWrap: {
    position: "relative",
    width: 64,
    height: 64,
  },
  avatarFallback: {
    fontSize: 22,
    color: colors.teal,
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
  },
  startCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeEmoji: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeEmojiText: {
    fontSize: 14,
    fontFamily: "System",
  },
  badgePause: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  itemLabel: {
    maxWidth: 64,
    fontSize: 12,
    fontFamily: "Quicksand_500Medium",
    fontWeight: "500",
    color: colors.foreground,
    textAlign: "center",
  },
  emptyHintWrap: {
    alignSelf: "center",
    paddingHorizontal: 12,
    height: 64,
    justifyContent: "center",
  },
  emptyHint: {
    fontSize: 12,
    fontStyle: "italic",
    fontFamily: "Fraunces_500Medium_Italic",
    color: colors.muted,
  },
});
