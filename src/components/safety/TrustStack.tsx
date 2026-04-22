import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
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

interface Props {
  userId: string;
  variant: TrustVariant;
  viewerId: string;
}

interface TrustState {
  profile: TrustProfile;
  tandemsCount: number;
  sharedCount: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function monthsOnTandem(createdAt: string | null): number {
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

function buildSignalText(
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

// ── Badge sub-components ─────────────────────────────────────────────────────

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
    <View
      style={s.badge}
      accessible
      accessibilityLabel={voiceLabel}
    >
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

export function TrustStack({ userId, variant, viewerId }: Props) {
  const [trust, setTrust] = useState<TrustState | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!userId || !viewerId) return;
    let cancelled = false;

    Promise.all([
      getTrustProfile(userId),
      getTandemsCount(userId),
      getSharedTandemsCount(viewerId, userId),
    ]).then(([profile, tandemsCount, sharedCount]) => {
      if (cancelled || !profile) return;
      setTrust({ profile, tandemsCount, sharedCount });
    });

    return () => { cancelled = true; };
  }, [userId, viewerId]);

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
  // Profile variant
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

  // Post-card variant
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

  // Post-detail variant
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
});

// ── Modal styles ─────────────────────────────────────────────────────────────

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
