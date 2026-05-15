// Bottom-sheet that opens when a host taps a pending join request.
// Shows the requester's full profile + auto-generated shared context so the
// host can decide who's in without making the requester write a pitch.

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Pressable,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Video, ResizeMode } from "expo-av";
import { colors, radius, shadows, gradients } from "../theme";
import { supabase } from "../lib/supabase";
import { TierAvatar, tierLabel } from "./safety/TierAvatar";
import type { TrustTier } from "../lib/trustService";
import { getSharedContext, type SharedContext } from "../lib/sharedContext";

const SHEET_HEIGHT_PCT = 0.92;

interface RequesterProfile {
  user_id: string;
  first_name: string | null;
  avatar_url: string | null;
  pronouns: string | null;
  year_of_school: string | null;
  birthday: string | null;
  selfie_verified: boolean;
  phone_verified: boolean;
  edu_verified: boolean;
  trust_tier: TrustTier;
  completed_tandem_count: number;
  quick_prompts: Record<string, string> | null;
  deep_prompts: Record<string, string> | null;
  video_url: string | null;
  bio: string | null;
}

function calculateAge(birthday: string | null): number | null {
  if (!birthday) return null;
  return Math.floor(
    (Date.now() - new Date(birthday).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  );
}

interface ScrapbookCard {
  id: string;
  cover_photo_url: string | null;
  title: string | null;
  photos: { photo_url: string }[];
}

interface Props {
  visible: boolean;
  requesterUserId: string | null;
  viewerUserId: string | null;
  activityTitle?: string;
  onClose: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onReport?: () => void;
}

export function RequestSheet({
  visible,
  requesterUserId,
  viewerUserId,
  activityTitle,
  onClose,
  onAccept,
  onDecline,
  onReport,
}: Props) {
  const insets = useSafeAreaInsets();
  const screenH = Dimensions.get("window").height;

  const [profile, setProfile] = useState<RequesterProfile | null>(null);
  const [shared, setShared] = useState<SharedContext | null>(null);
  const [scrapbook, setScrapbook] = useState<ScrapbookCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<"accept" | "decline" | null>(null);

  useEffect(() => {
    if (!visible || !requesterUserId || !viewerUserId) return;
    let cancelled = false;
    setLoading(true);
    setProfile(null);
    setShared(null);
    setScrapbook([]);

    (async () => {
      const [{ data: prof }, sharedCtx, { data: sb }] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "user_id, first_name, avatar_url, pronouns, year_of_school, birthday, selfie_verified, phone_verified, edu_verified, trust_tier, completed_tandem_count, quick_prompts, deep_prompts, video_url, bio",
          )
          .eq("user_id", requesterUserId)
          .maybeSingle(),
        getSharedContext(viewerUserId, requesterUserId),
        supabase
          .from("scrapbook_memories")
          .select("id, cover_photo_url, title, is_public, scrapbook_photos(photo_url, display_order)")
          .eq("user_id", requesterUserId)
          .eq("is_public", true)
          .order("created_at", { ascending: false })
          .limit(6),
      ]);
      if (cancelled) return;

      setProfile((prof as any) ?? null);
      setShared(sharedCtx);
      const cards: ScrapbookCard[] = ((sb as any[]) ?? []).map((m) => ({
        id: m.id,
        cover_photo_url: m.cover_photo_url ?? null,
        title: m.title ?? null,
        photos: Array.isArray(m.scrapbook_photos) ? m.scrapbook_photos : [],
      }));
      setScrapbook(cards);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, requesterUserId, viewerUserId]);

  const handleAccept = async () => {
    if (submitting) return;
    setSubmitting("accept");
    onAccept();
    // Parent owns dismissal timing for the celebration moment.
  };

  const handleDecline = async () => {
    if (submitting) return;
    setSubmitting("decline");
    onDecline();
  };

  const firstName = profile?.first_name ?? "someone";
  const tier = profile?.trust_tier ?? "new";
  const tierName = tierLabel(tier);
  const verified =
    !!profile?.selfie_verified || !!profile?.phone_verified || !!profile?.edu_verified;

  const quickPromptEntries = profile?.quick_prompts
    ? Object.entries(profile.quick_prompts).filter(([, v]) => !!v)
    : [];
  const deepPromptEntries = profile?.deep_prompts
    ? Object.entries(profile.deep_prompts).filter(([, v]) => !!v)
    : [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable
          style={[s.sheet, { height: screenH * SHEET_HEIGHT_PCT, paddingBottom: 0 }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Sticky header */}
          <View style={s.header}>
            <View style={s.handle} />
            <View style={s.headerRow}>
              <Text style={s.headerTitle}>decide who's in</Text>
              <TouchableOpacity
                onPress={onClose}
                style={s.closeBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>
            {activityTitle ? <Text style={s.headerSub}>{activityTitle}</Text> : null}
          </View>

          {loading || !profile ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator color={colors.teal} />
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
            >
              {/* Avatar + identity */}
              <View style={s.identityBlock}>
                <TierAvatar
                  uri={profile.avatar_url}
                  size={148}
                  tier={tier}
                  fallback={
                    <Text style={s.avatarFallback}>
                      {firstName.charAt(0).toUpperCase()}
                    </Text>
                  }
                />
                <Text style={s.name}>{firstName}</Text>
                <View style={s.metaRow}>
                  {(() => {
                    const age = calculateAge(profile.birthday);
                    const parts: string[] = [];
                    if (profile.pronouns) parts.push(profile.pronouns.toLowerCase());
                    if (age != null) parts.push(String(age));
                    if (profile.year_of_school) parts.push(profile.year_of_school);
                    return parts.map((p, i) => (
                      <React.Fragment key={i}>
                        {i > 0 ? <View style={s.metaDot} /> : null}
                        <Text style={s.metaText}>{p}</Text>
                      </React.Fragment>
                    ));
                  })()}
                </View>
                {verified ? (
                  <View style={s.verifiedRow}>
                    {profile.selfie_verified ? (
                      <View style={s.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={13} color={colors.teal} />
                        <Text style={s.verifiedText}>selfie</Text>
                      </View>
                    ) : null}
                    {profile.edu_verified ? (
                      <View style={s.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={13} color={colors.teal} />
                        <Text style={s.verifiedText}>.edu</Text>
                      </View>
                    ) : null}
                    {profile.phone_verified ? (
                      <View style={s.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={13} color={colors.teal} />
                        <Text style={s.verifiedText}>phone</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                {tierName ? <Text style={s.tierLabel}>{tierName.toLowerCase()}</Text> : null}
              </View>

              {/* Shared context card */}
              {shared && shared.commonCount > 0 ? (
                <View style={s.sharedCard}>
                  <Text style={s.sharedTitle}>here's what you have in common</Text>
                  {shared.sameYear && shared.viewerYear ? (
                    <View style={s.sharedRow}>
                      <Ionicons name="school-outline" size={15} color={colors.teal} />
                      <Text style={s.sharedRowText}>
                        same year — {shared.viewerYear.toLowerCase()}
                      </Text>
                    </View>
                  ) : null}
                  {shared.sharedInterests.length > 0 ? (
                    <View style={s.sharedRow}>
                      <Ionicons name="sparkles-outline" size={15} color={colors.teal} />
                      <Text style={s.sharedRowText}>
                        you're both into {shared.sharedInterests.slice(0, 3).join(", ")}
                      </Text>
                    </View>
                  ) : null}
                  {shared.mutualTandemers > 0 ? (
                    <View style={s.sharedRow}>
                      <Ionicons name="people-outline" size={15} color={colors.teal} />
                      <Text style={s.sharedRowText}>
                        {shared.mutualTandemers} mutual tandemer
                        {shared.mutualTandemers === 1 ? "" : "s"}
                      </Text>
                    </View>
                  ) : null}
                  {shared.sharedTandemHistory.length > 0 ? (
                    <View style={s.sharedRow}>
                      <Ionicons name="time-outline" size={15} color={colors.teal} />
                      <Text style={s.sharedRowText}>
                        you've both tandem'd around{" "}
                        {shared.sharedTandemHistory.map((h) => h.activityTitle).join(" + ")}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Bio */}
              {profile.bio ? (
                <View style={s.section}>
                  <Text style={s.bioText}>"{profile.bio}"</Text>
                </View>
              ) : null}

              {/* Quick prompts */}
              {quickPromptEntries.length > 0 ? (
                <View style={s.section}>
                  <Text style={s.sectionLabel}>about {firstName}</Text>
                  {quickPromptEntries.map(([key, val]) => (
                    <View key={key} style={s.promptRow}>
                      <Text style={s.promptKey}>{key.replace(/_/g, " ").toLowerCase()}</Text>
                      <Text style={s.promptVal}>{val}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Deep prompts */}
              {deepPromptEntries.length > 0 ? (
                <View style={s.section}>
                  {deepPromptEntries.map(([key, val]) => (
                    <View key={key} style={s.deepPromptBlock}>
                      <Text style={s.deepPromptKey}>
                        {key.replace(/_/g, " ").toLowerCase()}
                      </Text>
                      <Text style={s.deepPromptVal}>{val}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Intro video */}
              {profile.video_url ? (
                <View style={s.section}>
                  <Text style={s.sectionLabel}>intro video</Text>
                  <View style={s.videoFrame}>
                    <Video
                      source={{ uri: profile.video_url }}
                      style={s.video}
                      useNativeControls
                      resizeMode={ResizeMode.COVER}
                      isLooping={false}
                    />
                  </View>
                </View>
              ) : null}

              {/* Scrapbook strip */}
              {scrapbook.length > 0 ? (
                <View style={s.section}>
                  <Text style={s.sectionLabel}>{firstName}'s scrapbook</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 4, gap: 12 }}
                  >
                    {scrapbook.map((m) => {
                      const cover =
                        m.cover_photo_url ||
                        (m.photos.length > 0 ? m.photos[0].photo_url : null);
                      return (
                        <View key={m.id} style={s.polaroid}>
                          {cover ? (
                            <Image source={{ uri: cover }} style={s.polaroidPhoto} />
                          ) : (
                            <View style={[s.polaroidPhoto, s.polaroidEmpty]} />
                          )}
                          {m.title ? (
                            <Text style={s.polaroidTitle} numberOfLines={1}>
                              {m.title}
                            </Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              {/* Completed tandem count */}
              <View style={s.tandemCountRow}>
                <Text style={s.tandemCountText}>
                  {profile.completed_tandem_count} completed tandem
                  {profile.completed_tandem_count === 1 ? "" : "s"}
                </Text>
              </View>

              {/* Report link */}
              {onReport ? (
                <TouchableOpacity style={s.reportLinkWrap} onPress={onReport} activeOpacity={0.7}>
                  <Ionicons name="flag-outline" size={13} color={colors.muted} />
                  <Text style={s.reportLinkText}>report {firstName}</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          )}

          {/* Sticky footer */}
          {!loading && profile ? (
            <View
              style={[
                s.footer,
                { paddingBottom: Math.max(insets.bottom, 14) + 14 },
              ]}
            >
              <TouchableOpacity
                onPress={handleDecline}
                disabled={submitting !== null}
                activeOpacity={0.85}
                style={s.declineBtn}
              >
                <Text style={s.declineText}>maybe next time</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAccept}
                disabled={submitting !== null}
                activeOpacity={0.88}
                style={s.acceptBtnWrap}
              >
                <LinearGradient
                  colors={gradients.brand}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.acceptBtn}
                >
                  {submitting === "accept" ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={s.acceptText}>i'm in →</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  header: {
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 20,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Quicksand_700Bold",
    color: colors.foreground,
  },
  headerSub: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
    fontFamily: "Quicksand_500Medium",
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  identityBlock: {
    alignItems: "center",
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  avatarFallback: {
    fontSize: 48,
    fontWeight: "700",
    fontFamily: "Quicksand_700Bold",
    color: colors.teal,
  },
  name: {
    fontSize: 26,
    fontWeight: "700",
    fontFamily: "Quicksand_700Bold",
    color: colors.foreground,
    marginTop: 14,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  metaText: {
    fontSize: 13,
    color: colors.muted,
    fontFamily: "Quicksand_500Medium",
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.muted,
  },
  verifiedRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: colors.secondary,
    fontFamily: "Quicksand_600SemiBold",
  },
  tierLabel: {
    marginTop: 10,
    fontSize: 16,
    fontStyle: "italic",
    fontFamily: "Fraunces_500Medium_Italic",
    color: colors.teal,
  },
  sharedCard: {
    marginHorizontal: 20,
    marginTop: 14,
    padding: 16,
    backgroundColor: colors.tintTeal,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.teal + "55",
    gap: 10,
  },
  sharedTitle: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Quicksand_700Bold",
    color: colors.foreground,
    marginBottom: 2,
  },
  sharedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sharedRowText: {
    fontSize: 14,
    color: colors.secondary,
    fontFamily: "Quicksand_500Medium",
    flex: 1,
  },
  section: {
    marginTop: 22,
    paddingHorizontal: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Quicksand_700Bold",
    color: colors.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  bioText: {
    fontSize: 16,
    fontStyle: "italic",
    fontFamily: "Fraunces_500Medium_Italic",
    color: colors.secondary,
    lineHeight: 24,
    textAlign: "center",
  },
  promptRow: {
    flexDirection: "row",
    paddingVertical: 6,
    gap: 12,
  },
  promptKey: {
    fontSize: 13,
    color: colors.muted,
    fontFamily: "Quicksand_500Medium",
    width: 110,
  },
  promptVal: {
    flex: 1,
    fontSize: 14,
    color: colors.foreground,
    fontFamily: "Quicksand_500Medium",
  },
  deepPromptBlock: {
    marginBottom: 16,
  },
  deepPromptKey: {
    fontSize: 12,
    color: colors.teal,
    fontFamily: "Quicksand_700Bold",
    textTransform: "lowercase",
    marginBottom: 4,
  },
  deepPromptVal: {
    fontSize: 15,
    color: colors.foreground,
    fontFamily: "Quicksand_500Medium",
    lineHeight: 21,
  },
  videoFrame: {
    width: "100%",
    aspectRatio: 9 / 16,
    maxHeight: 320,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  video: {
    width: "100%",
    height: "100%",
  },
  polaroid: {
    width: 120,
    backgroundColor: colors.white,
    padding: 6,
    paddingBottom: 10,
    borderRadius: 4,
    ...shadows.card,
  },
  polaroidPhoto: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderRadius: 2,
    marginBottom: 6,
  },
  polaroidEmpty: {
    backgroundColor: colors.tintTeal,
  },
  polaroidTitle: {
    fontSize: 11,
    color: colors.secondary,
    fontFamily: "Quicksand_500Medium",
    textAlign: "center",
  },
  tandemCountRow: {
    marginTop: 22,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  tandemCountText: {
    fontSize: 13,
    color: colors.muted,
    fontFamily: "Quicksand_500Medium",
  },
  reportLinkWrap: {
    marginTop: 18,
    paddingHorizontal: 20,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  reportLinkText: {
    fontSize: 12,
    color: colors.muted,
    fontFamily: "Quicksand_500Medium",
    textDecorationLine: "underline",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  declineBtn: {
    flex: 1,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  declineText: {
    fontSize: 14,
    color: colors.secondary,
    fontFamily: "Quicksand_600SemiBold",
  },
  acceptBtnWrap: {
    flex: 1,
    borderRadius: radius.full,
    overflow: "hidden",
    ...shadows.brand,
  },
  acceptBtn: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptText: {
    fontSize: 15,
    color: colors.white,
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
  },
});
