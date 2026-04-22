import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, shadows } from "../../theme";
import {
  getTrustProfile,
  getTandemsCount,
  getSharedTandemsCount,
  type TrustProfile,
} from "../../lib/trustService";

export type TrustVariant = "profile" | "post-card" | "post-detail";

export interface TrustState {
  profile: TrustProfile;
  tandemsCount: number;
  sharedCount: number;
}

interface Props {
  userId: string;
  variant: TrustVariant;
  viewerId: string;
  // Dev-only: supply pre-baked data to skip the Supabase fetch entirely.
  mockTrust?: TrustState;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function monthsOnTandem(createdAt: string | null): number {
  if (!createdAt) return 0;
  const d = new Date(createdAt);
  const now = new Date();
  return Math.max(
    0,
    (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth()
  );
}

function getSubjectPronoun(pronouns: string | null): "she" | "he" | "they" {
  if (!pronouns) return "they";
  const p = pronouns.toLowerCase();
  if (p.startsWith("she")) return "she";
  if (p.startsWith("he")) return "he";
  return "they";
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function buildSignalText(
  name: string,
  pronouns: string | null,
  months: number,
  tandemsCount: number,
  sharedCount: number
): string {
  const sub = getSubjectPronoun(pronouns);
  const subVerb = sub === "she" ? "she's" : sub === "he" ? "he's" : "they've";
  const timesStr = plural(tandemsCount, "time");
  const monthsStr = plural(months, "month");

  if (tandemsCount === 0 && months < 1) {
    return `${name} just joined tandem and is verified. this would be both of your first tandems.`;
  }
  if (tandemsCount === 0) {
    return `${name} hasn't tandem'd with anyone yet, but they're verified.`;
  }
  if (months < 1) {
    return `${name} is new to tandem. they've tandem'd ${timesStr} and you've tandem'd with ${sharedCount} of the same people.`;
  }
  if (sharedCount === 0) {
    return `${name}'s been on tandem for ${monthsStr}. ${subVerb} tandem'd ${timesStr} and this would be your first shared tandem.`;
  }
  return `${name}'s been on tandem for ${monthsStr}. ${subVerb} tandem'd ${timesStr} and you've tandem'd with ${sharedCount} of the same people.`;
}

// ── Skeleton (post-detail loading only) ─────────────────────────────────────

function PostDetailSkeleton() {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={[s.detailBlock, { opacity }]}>
      <View style={s.skeletonLine} />
      <View style={[s.skeletonLine, s.skeletonLineShort]} />
    </Animated.View>
  );
}

// ── Verification explainer modal ─────────────────────────────────────────────

const EXPLAINER_ROWS = [
  {
    label: "selfie verification",
    body: "we check that you're a real person and that your selfie matches your profile photo.",
  },
  {
    label: "phone verification",
    body: "we send a code to your number to confirm it's yours.",
  },
  {
    label: ".edu verification",
    body: "we confirm your college email so you know everyone here is actually a student.",
  },
  {
    label: "shared tandems",
    body: "these are people you and someone else have both tandem'd with.",
  },
];

function ExplainerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={[m.backdrop, { paddingBottom: insets.bottom + 16 }]} onPress={onClose}>
        <Pressable style={m.card} onPress={(e) => e.stopPropagation()}>
          <Text style={m.modalTitle}>here's how tandem keeps things safe.</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 16 }}>
            {EXPLAINER_ROWS.map((row) => (
              <View key={row.label} style={m.row}>
                <Text style={m.rowLabel}>{row.label}</Text>
                <Text style={m.rowBody}>{row.body}</Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={m.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={m.closeBtnText}>close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Badge sub-component ──────────────────────────────────────────────────────

function VerifiedBadge({
  verified,
  label,
  voiceLabel,
}: {
  verified: boolean;
  label: string;
  voiceLabel: string;
}) {
  return (
    <View style={s.badge} accessible accessibilityLabel={voiceLabel}>
      <Ionicons
        name={verified ? "checkmark-circle" : "ellipse-outline"}
        size={14}
        color={verified ? colors.teal : colors.muted}
      />
      <Text style={[s.badgeText, !verified && s.badgeTextMuted]}>{label}</Text>
    </View>
  );
}

// ── Profile variant ──────────────────────────────────────────────────────────

function ProfileTrust({ trust }: { trust: TrustState }) {
  const { profile, sharedCount } = trust;
  return (
    <View style={s.profileRow}>
      <VerifiedBadge
        verified={profile.selfieVerified}
        label="selfie"
        voiceLabel={profile.selfieVerified ? "selfie verified" : "selfie not verified"}
      />
      <VerifiedBadge
        verified={profile.phoneVerified}
        label="phone"
        voiceLabel={profile.phoneVerified ? "phone verified" : "phone not verified"}
      />
      <VerifiedBadge
        verified={profile.eduVerified}
        label=".edu"
        voiceLabel={profile.eduVerified ? "dot edu verified" : "dot edu not verified"}
      />
      <View style={s.dot} />
      <Text style={s.sharedText}>{sharedCount} shared tandems</Text>
    </View>
  );
}

// ── Post-card variant ────────────────────────────────────────────────────────

function PostCardTrust({ trust }: { trust: TrustState }) {
  const { profile, sharedCount } = trust;
  const months = monthsOnTandem(profile.createdAt);
  const anyVerified = profile.selfieVerified || profile.phoneVerified || profile.eduVerified;
  return (
    <View style={s.cardRow}>
      <Text style={s.cardName}>{profile.firstName}</Text>
      {anyVerified && (
        <>
          <Text style={s.cardSep}> • </Text>
          <Ionicons
            name="checkmark-circle"
            size={13}
            color={colors.teal}
            accessible
            accessibilityLabel="verified"
          />
          <Text style={s.cardVerified}> verified</Text>
        </>
      )}
      <Text style={s.cardSep}> • </Text>
      <Text style={s.cardMeta}>{sharedCount} shared tandems</Text>
      <Text style={s.cardSep}> • </Text>
      <Text style={s.cardMeta}>{months < 1 ? "new" : `${months}mo`} on tandem</Text>
    </View>
  );
}

// ── Post-detail variant ──────────────────────────────────────────────────────

function PostDetailTrust({ trust }: { trust: TrustState }) {
  const { profile, tandemsCount, sharedCount } = trust;
  const months = monthsOnTandem(profile.createdAt);
  const text = buildSignalText(
    profile.firstName,
    profile.pronouns,
    months,
    tandemsCount,
    sharedCount
  );
  return (
    <View style={s.detailBlock}>
      <Text style={s.detailText}>{text}</Text>
    </View>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function TrustStack({ userId, variant, viewerId, mockTrust }: Props) {
  const [trust, setTrust] = useState<TrustState | null>(() => mockTrust ?? null);
  const [loading, setLoading] = useState(!mockTrust);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (mockTrust) {
      setTrust(mockTrust);
      setLoading(false);
      return;
    }
    if (!userId || !viewerId) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      getTrustProfile(userId),
      getTandemsCount(userId),
      getSharedTandemsCount(viewerId, userId),
    ]).then(([profile, tandemsCount, sharedCount]) => {
      if (cancelled || !profile) return;
      setTrust({ profile, tandemsCount, sharedCount });
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [userId, viewerId, mockTrust]);

  // Post-detail shows a skeleton while loading; other variants render nothing.
  if (loading) {
    return variant === "post-detail" ? <PostDetailSkeleton /> : null;
  }
  if (!trust) return null;

  return (
    <>
      <TouchableOpacity
        onPress={() => setShowModal(true)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="view verification details"
      >
        {variant === "profile" && <ProfileTrust trust={trust} />}
        {variant === "post-card" && <PostCardTrust trust={trust} />}
        {variant === "post-detail" && <PostDetailTrust trust={trust} />}
      </TouchableOpacity>
      <ExplainerModal visible={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.foreground,
    fontFamily: "Quicksand_600SemiBold",
  },
  badgeTextMuted: {
    color: colors.muted,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.muted,
    marginHorizontal: 2,
  },
  sharedText: {
    fontSize: 13,
    color: colors.secondary,
    fontFamily: "Quicksand_400Regular",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  cardName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.foreground,
    fontFamily: "Quicksand_700Bold",
  },
  cardSep: {
    fontSize: 13,
    color: colors.muted,
  },
  cardVerified: {
    fontSize: 13,
    color: colors.teal,
    fontFamily: "Quicksand_600SemiBold",
  },
  cardMeta: {
    fontSize: 13,
    color: colors.muted,
    fontFamily: "Quicksand_400Regular",
  },
  detailBlock: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 8,
  },
  detailText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.secondary,
    fontFamily: "Quicksand_400Regular",
  },
  skeletonLine: {
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.border,
    width: "100%",
  },
  skeletonLineShort: {
    width: "70%",
    marginTop: 10,
  },
});

const m = StyleSheet.create({
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
    maxHeight: "80%",
    ...shadows.card,
  },
  modalTitle: {
    fontFamily: "Caveat_700Bold",
    fontSize: 22,
    fontStyle: "italic",
    color: colors.foreground,
    textAlign: "center",
  },
  row: {
    marginBottom: 14,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.foreground,
    fontFamily: "Quicksand_700Bold",
    marginBottom: 2,
  },
  rowBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.secondary,
    fontFamily: "Quicksand_400Regular",
  },
  closeBtn: {
    marginTop: 8,
    backgroundColor: colors.teal,
    borderRadius: radius.full,
    paddingVertical: 12,
    alignItems: "center",
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.white,
    fontFamily: "Quicksand_600SemiBold",
  },
});
