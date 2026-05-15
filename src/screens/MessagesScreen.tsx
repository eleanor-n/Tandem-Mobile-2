import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import SunnyAvatar from "../components/SunnyAvatar";
import { BottomNav } from "../components/BottomNav";
import { LinearGradient } from "expo-linear-gradient";
import {
  useFonts,
  Fraunces_500Medium_Italic,
  Fraunces_700Bold_Italic,
} from "@expo-google-fonts/fraunces";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { colors, radius, gradients } from "../theme";
import { TierAvatar } from "../components/safety/TierAvatar";
import type { TrustTier } from "../lib/trustService";
import { RequestSheet } from "../components/RequestSheet";
import { ReportUserModal } from "../components/safety/ReportUserModal";

export interface Conversation {
  id: string;
  name: string;
  photo: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
  isNew?: boolean;
  completed?: boolean;
}

interface PendingRequest {
  joinRequestId: string;
  activityId: string;
  activityTitle: string;
  requesterId: string;
  requesterName: string;
  requesterPhoto: string | null;
  requesterTier: TrustTier;
  createdAt: string;
}

const formatTimestamp = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
};

interface MessagesScreenProps {
  onOpenChat: (convo: { id: string; name: string; photo: string }) => void;
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  onPostPress?: () => void;
}

export const MessagesScreen = ({
  onOpenChat,
  activeTab,
  onTabPress,
  onPostPress,
}: MessagesScreenProps) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  useFonts({ Fraunces_500Medium_Italic, Fraunces_700Bold_Italic });

  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [activeConvos, setActiveConvos] = useState<Conversation[]>([]);
  const [pastConvos, setPastConvos] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pastExpanded, setPastExpanded] = useState(false);

  // RequestSheet state
  const [openRequest, setOpenRequest] = useState<PendingRequest | null>(null);
  const [reportTarget, setReportTarget] = useState<PendingRequest | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const [tandemsRes, requestsRes] = await Promise.all([
        // Tandems where viewer participates
        supabase
          .from("tandems")
          .select("id, user_a_id, user_b_id, activity_id, status, created_at")
          .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`),
        // Pending join requests on viewer's own activities
        supabase
          .from("join_requests")
          .select(
            "id, activity_id, requester_id, status, created_at, activities!inner(id, title, user_id)",
          )
          .eq("status", "pending")
          .eq("activities.user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      const tandems = (tandemsRes.data ?? []) as any[];
      const requests = (requestsRes.data ?? []) as any[];

      // Pull profile data for all involved partners + requesters in one shot.
      const partnerIds = tandems.map((t) =>
        t.user_a_id === user.id ? t.user_b_id : t.user_a_id,
      );
      const requesterIds = requests.map((r) => r.requester_id);
      const allIds = Array.from(new Set([...partnerIds, ...requesterIds])).filter(Boolean);

      const profilesRes =
        allIds.length > 0
          ? await supabase
              .from("profiles")
              .select("user_id, first_name, avatar_url, trust_tier")
              .in("user_id", allIds)
          : { data: [] as any[] };

      const profileMap: Record<string, any> = {};
      for (const p of (profilesRes.data ?? []) as any[]) profileMap[p.user_id] = p;

      // Build pending requests list
      const pending: PendingRequest[] = requests.map((r) => {
        const prof = profileMap[r.requester_id] ?? {};
        return {
          joinRequestId: r.id,
          activityId: r.activity_id,
          activityTitle: r.activities?.title ?? "your tandem",
          requesterId: r.requester_id,
          requesterName: prof.first_name ?? "someone",
          requesterPhoto: prof.avatar_url ?? null,
          requesterTier: (prof.trust_tier ?? "new") as TrustTier,
          createdAt: r.created_at,
        };
      });

      // Fetch latest messages for each tandem in parallel
      const messageResults = await Promise.all(
        tandems.map((t) =>
          supabase
            .from("messages")
            .select("content, created_at, sender_id")
            .eq("tandem_id", t.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ),
      );

      const all: Conversation[] = tandems.map((t, i) => {
        const partnerId = t.user_a_id === user.id ? t.user_b_id : t.user_a_id;
        const prof = profileMap[partnerId] ?? {};
        const msg = messageResults[i].data as any;
        const completed = t.status === "completed";
        return {
          id: t.id,
          name: prof.first_name ?? "user",
          photo: prof.avatar_url ?? "",
          lastMessage: msg ? msg.content : completed ? "tandem complete." : "tap to say hey",
          timestamp: msg ? formatTimestamp(msg.created_at) : "",
          unread: msg ? msg.sender_id !== user.id : false,
          isNew: !msg && !completed,
          completed,
        };
      });

      setPendingRequests(pending);
      setActiveConvos(all.filter((c) => !c.completed));
      setPastConvos(all.filter((c) => c.completed));
    } catch (err) {
      console.warn("[MessagesScreen] fetch failed:", err);
      setPendingRequests([]);
      setActiveConvos([]);
      setPastConvos([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const handleAcceptRequest = async () => {
    if (!openRequest || !user) return;
    const req = openRequest;
    // Mark accepted in join_requests
    await supabase
      .from("join_requests")
      .update({ status: "accepted" })
      .eq("id", req.joinRequestId);

    // Ensure a tandem row exists
    const { data: tandemRow } = await supabase
      .from("tandems")
      .upsert(
        {
          activity_id: req.activityId,
          user_a_id: user.id,
          user_b_id: req.requesterId,
        },
        { onConflict: "user_a_id,user_b_id,activity_id", ignoreDuplicates: false },
      )
      .select("id")
      .maybeSingle();

    // Notify requester
    try {
      await supabase.functions.invoke("notify-request-accepted", {
        body: { requester_id: req.requesterId, activity_id: req.activityId },
      });
    } catch {
      /* non-blocking */
    }

    // Remove from list optimistically
    setPendingRequests((prev) => prev.filter((r) => r.joinRequestId !== req.joinRequestId));

    // Brief celebration delay, then navigate into chat
    setTimeout(() => {
      setOpenRequest(null);
      if (tandemRow?.id) {
        onOpenChat({
          id: tandemRow.id,
          name: req.requesterName,
          photo: req.requesterPhoto ?? "",
        });
      }
      fetchAll();
    }, 1500);
  };

  const handleDeclineRequest = async () => {
    if (!openRequest) return;
    const req = openRequest;
    await supabase
      .from("join_requests")
      .update({ status: "declined" })
      .eq("id", req.joinRequestId);
    setPendingRequests((prev) => prev.filter((r) => r.joinRequestId !== req.joinRequestId));
    setOpenRequest(null);
  };

  const totalCount = pendingRequests.length + activeConvos.length + pastConvos.length;
  const isEmpty = !loading && totalCount === 0;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <Text style={s.title}>chats</Text>
      </View>

      {isEmpty ? (
        <View style={s.empty}>
          <SunnyAvatar expression="warm" size={84} />
          <Text style={s.emptySunnyLine}>
            no tandems yet. when someone joins your plans, this is where you'll talk.
          </Text>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => onPostPress?.()}
            style={s.emptyCta}
          >
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.emptyCtaInner}
            >
              <Text style={s.emptyCtaText}>Post a tandem</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 90 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.teal}
            />
          }
        >
          {/* Requests section */}
          {pendingRequests.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionLabel}>requests</Text>
                <View style={s.countBadge}>
                  <Text style={s.countBadgeText}>{pendingRequests.length}</Text>
                </View>
              </View>
              {pendingRequests.map((r) => (
                <TouchableOpacity
                  key={r.joinRequestId}
                  style={s.requestRow}
                  onPress={() => setOpenRequest(r)}
                  activeOpacity={0.85}
                >
                  <TierAvatar
                    uri={r.requesterPhoto}
                    size={52}
                    tier={r.requesterTier}
                    fallback={
                      <Text style={s.avatarInitialText}>
                        {r.requesterName.charAt(0).toUpperCase()}
                      </Text>
                    }
                  />
                  <View style={s.requestInfo}>
                    <Text style={s.requestName}>
                      {r.requesterName} wants in
                    </Text>
                    <Text style={s.requestActivity} numberOfLines={1}>
                      {r.activityTitle}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Active section */}
          {activeConvos.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionLabel}>active</Text>
              </View>
              {activeConvos.map((c) => (
                <ConversationRow
                  key={c.id}
                  convo={c}
                  onPress={() =>
                    onOpenChat({ id: c.id, name: c.name, photo: c.photo })
                  }
                />
              ))}
            </View>
          )}

          {/* Past section (collapsed by default) */}
          {pastConvos.length > 0 && (
            <View style={s.section}>
              <TouchableOpacity
                onPress={() => setPastExpanded((v) => !v)}
                style={s.sectionHeader}
                activeOpacity={0.7}
              >
                <Text style={s.sectionLabel}>past tandems</Text>
                <Ionicons
                  name={pastExpanded ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={colors.muted}
                />
              </TouchableOpacity>
              {pastExpanded &&
                pastConvos.map((c) => (
                  <ConversationRow
                    key={c.id}
                    convo={c}
                    onPress={() =>
                      onOpenChat({ id: c.id, name: c.name, photo: c.photo })
                    }
                    dimmed
                  />
                ))}
            </View>
          )}
        </ScrollView>
      )}

      <BottomNav
        activeTab={activeTab ?? "Chat"}
        onTabPress={onTabPress ?? (() => {})}
        onPostPress={onPostPress}
      />

      <RequestSheet
        visible={!!openRequest}
        requesterUserId={openRequest?.requesterId ?? null}
        viewerUserId={user?.id ?? null}
        activityTitle={openRequest?.activityTitle}
        onClose={() => setOpenRequest(null)}
        onAccept={handleAcceptRequest}
        onDecline={handleDeclineRequest}
        onReport={() => {
          if (openRequest) {
            setReportTarget(openRequest);
            setOpenRequest(null);
          }
        }}
      />

      <ReportUserModal
        visible={!!reportTarget}
        reportedUserId={reportTarget?.requesterId ?? ""}
        reportedUserName={reportTarget?.requesterName}
        activityId={reportTarget?.activityId}
        onClose={() => setReportTarget(null)}
      />
    </View>
  );
};

function ConversationRow({
  convo,
  onPress,
  dimmed,
}: {
  convo: Conversation;
  onPress: () => void;
  dimmed?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[s.row, convo.unread && s.rowUnread, dimmed && s.rowDimmed]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {convo.unread && <View style={s.unreadBar} />}
      <View style={s.avatarWrap}>
        {convo.photo ? (
          <Image source={{ uri: convo.photo }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarInitial]}>
            <Text style={s.avatarInitialText}>
              {(convo.name ?? "?").charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {convo.unread && <View style={s.dot} />}
      </View>
      <View style={s.info}>
        <View style={s.nameRow}>
          <Text style={[s.name, convo.unread && s.nameUnread]}>{convo.name}</Text>
          <Text style={s.time}>{convo.timestamp}</Text>
        </View>
        <Text
          style={[
            s.preview,
            convo.unread && s.previewUnread,
            convo.isNew && s.previewNew,
          ]}
          numberOfLines={1}
        >
          {convo.lastMessage}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    fontFamily: "Quicksand_700Bold",
    color: colors.foreground,
    letterSpacing: -0.5,
  },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingBottom: 100,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Quicksand_700Bold",
    color: colors.foreground,
  },
  emptyDesc: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 20,
  },
  emptySunnyLine: {
    fontSize: 22,
    color: "#1F2937",
    fontFamily: "Fraunces_500Medium_Italic",
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 28,
    paddingHorizontal: 8,
  },
  emptyCta: {
    width: "100%",
    height: 52,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 8,
  },
  emptyCtaInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyCtaText: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Quicksand_700Bold",
    color: "#fff",
  },

  // Sections
  section: { marginTop: 12 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Quicksand_700Bold",
    color: colors.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Quicksand_700Bold",
    color: colors.white,
  },

  // Request rows
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.tintTeal,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.teal + "33",
    gap: 14,
    marginBottom: 1,
  },
  requestInfo: { flex: 1 },
  requestName: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Quicksand_700Bold",
    color: colors.foreground,
  },
  requestActivity: {
    fontSize: 13,
    color: colors.secondary,
    fontFamily: "Quicksand_500Medium",
    marginTop: 2,
  },

  // Convo rows
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    backgroundColor: colors.background,
    gap: 14,
  },
  rowUnread: { backgroundColor: colors.tintTeal },
  rowDimmed: { opacity: 0.6 },
  unreadBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.teal,
    borderRadius: 2,
  },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
  avatarInitial: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.tintTeal,
  },
  avatarInitialText: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Quicksand_700Bold",
    color: colors.teal,
  },
  dot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.teal,
    borderWidth: 2,
    borderColor: colors.background,
  },
  info: { flex: 1 },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 3,
  },
  name: {
    fontSize: 15,
    fontWeight: "500",
    fontFamily: "Quicksand_500Medium",
    color: colors.foreground,
  },
  nameUnread: { fontWeight: "700", fontFamily: "Quicksand_700Bold" },
  time: { fontSize: 12, color: "#9CA3AF" },
  preview: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  previewUnread: {
    color: colors.foreground,
    fontWeight: "500",
    fontFamily: "Quicksand_500Medium",
  },
  previewNew: { fontStyle: "italic", color: colors.teal },
});
