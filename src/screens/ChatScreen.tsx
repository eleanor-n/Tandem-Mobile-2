import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, Image,
  Modal, Pressable, Alert, Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, shadows, gradients } from "../theme";
import { useVerificationGate } from "../lib/verificationGate";
import { VerificationGateModal } from "../components/safety/VerificationGateModal";
import { EmergencyConfirmModal } from "../components/safety/EmergencyConfirmModal";
import { useFonts, Fraunces_500Medium_Italic, Fraunces_700Bold_Italic } from "@expo-google-fonts/fraunces";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

interface ActiveSpotShare {
  share_id: string;
  expires_at: string;
  sharer_user_id: string;
}

interface ChatScreenProps {
  convo: { id: string; name: string; photo: string; age?: number };
  onBack: () => void;
  onTakeSelfie?: () => void;
  onSendSpot?: () => void;
}

interface ChatMessage {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
}

export const ChatScreen = ({ convo, onBack, onTakeSelfie, onSendSpot }: ChatScreenProps) => {
  const insets = useSafeAreaInsets();
  useFonts({ Fraunces_500Medium_Italic, Fraunces_700Bold_Italic });
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<ScrollView | null>(null);
  const gate = useVerificationGate();
  const [activeShare, setActiveShare] = useState<ActiveSpotShare | null>(null);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [overflowVisible, setOverflowVisible] = useState(false);
  const [removeConfirmVisible, setRemoveConfirmVisible] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [blockConfirmVisible, setBlockConfirmVisible] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [isPoster, setIsPoster] = useState(false);
  const [tandemContext, setTandemContext] = useState<{
    activityId: string | null;
    partnerId: string | null;
  }>({ activityId: null, partnerId: null });

  useEffect(() => {
    let cancelled = false;
    if (!convo.id || !user) return;
    (async () => {
      const { data: tandem } = await supabase
        .from("tandems")
        .select("user_a_id, user_b_id, activity_id")
        .eq("id", convo.id)
        .maybeSingle();
      if (cancelled || !tandem) return;
      const partnerId =
        (tandem as any).user_a_id === user.id ? (tandem as any).user_b_id : (tandem as any).user_a_id;
      setTandemContext({
        activityId: (tandem as any).activity_id ?? null,
        partnerId: partnerId ?? null,
      });
      if ((tandem as any).activity_id) {
        const { data: act } = await supabase
          .from("activities")
          .select("user_id")
          .eq("id", (tandem as any).activity_id)
          .maybeSingle();
        if (!cancelled) setIsPoster((act as any)?.user_id === user.id);
      }
    })();
    return () => { cancelled = true; };
  }, [convo.id, user]);

  const handleRemoveFromTandem = async () => {
    if (removing) return;
    setRemoving(true);
    try {
      await supabase.functions.invoke("remove-from-tandem", {
        body: { tandem_id: convo.id },
      });
    } catch (err) {
      console.warn("[ChatScreen] remove failed:", err);
    } finally {
      setRemoving(false);
      setRemoveConfirmVisible(false);
      onBack();
    }
  };

  const handleBlockUser = async () => {
    if (blocking) return;
    if (!user || !tandemContext.partnerId) return;
    setBlocking(true);
    try {
      // Remove from this tandem first so the chat disappears for them,
      // then block so neither side surfaces in the other's feed.
      await supabase.functions.invoke("remove-from-tandem", {
        body: { tandem_id: convo.id },
      });
      await supabase.from("blocked_users").upsert(
        { blocker_id: user.id, blocked_id: tandemContext.partnerId },
        { ignoreDuplicates: true } as any,
      );
    } catch (err) {
      console.warn("[ChatScreen] block failed:", err);
    } finally {
      setBlocking(false);
      setBlockConfirmVisible(false);
      onBack();
    }
  };

  const fetchActiveShare = useCallback(async () => {
    if (!convo.id) return;
    const { data } = await supabase
      .from("spot_shares")
      .select("share_id, expires_at, sharer_user_id, status")
      .eq("tandem_id", convo.id)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveShare((data as any) ?? null);
  }, [convo.id]);

  useEffect(() => {
    fetchActiveShare();
  }, [fetchActiveShare]);

  const endActiveShare = async () => {
    if (!activeShare) return;
    try {
      await supabase.functions.invoke("end-spot-share", {
        body: { share_id: activeShare.share_id, reason: "manual" },
      });
    } catch (err) {
      console.warn("[ChatScreen] end share failed:", err);
    }
    setActiveShare(null);
  };

  const handleNeedHelp = async () => {
    setHelpModalVisible(false);

    // Fire admin alert in the background (non-blocking)
    supabase.functions
      .invoke("trigger-emergency-alert", { body: { tandem_id: convo.id } })
      .catch((err) => console.warn("[ChatScreen] emergency alert failed:", err));

    // Look up the active spot share to pull the recipient phone + context for SMS
    let smsUrl: string | null = null;
    try {
      const { data: share } = await supabase
        .from("spot_shares")
        .select("share_id, recipient_phone")
        .eq("tandem_id", convo.id)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (share?.recipient_phone) {
        const { data: callerProf } = await supabase.auth.getUser();
        const callerName = callerProf?.user?.user_metadata?.first_name ?? "your friend";

        let actTitle = "a tandem";
        let actLocation = "";
        if (tandemContext.activityId) {
          const { data: act } = await supabase
            .from("activities")
            .select("title, location_name")
            .eq("id", tandemContext.activityId)
            .maybeSingle();
          actTitle = (act as any)?.title ?? actTitle;
          actLocation = (act as any)?.location_name ?? "";
        }

        const shareUrl = `https://thetandemweb.com/spot-share/${share.share_id}`;
        const locationFragment = actLocation ? ` in ${actLocation}` : "";
        const messageBody = `Emergency. I need help. ${callerName}, currently at ${actTitle}${locationFragment}. Spot share: ${shareUrl}`;
        const separator = Platform.OS === "ios" ? "&" : "?";
        smsUrl = `sms:${share.recipient_phone}${separator}body=${encodeURIComponent(messageBody)}`;
      }
    } catch (err) {
      console.warn("[ChatScreen] sms lookup failed:", err);
    }

    // Open the native SMS composer first (so the user can hit send while 911
    // is dialing). If we have no recipient phone, skip directly to the dialer.
    const finishWithCall = () => {
      Linking.openURL("tel:911").catch(() => {
        Alert.alert("couldn't open dialer.", "call 911 directly.");
      });
    };

    if (smsUrl) {
      Linking.openURL(smsUrl)
        .catch(() => { /* still call 911 */ })
        .finally(finishWithCall);
    } else {
      finishWithCall();
    }
  };

  // Initial load + realtime subscription on messages for this tandem.
  useEffect(() => {
    if (!convo.id) return;
    let cancelled = false;

    supabase
      .from("messages")
      .select("id, content, sender_id, created_at")
      .eq("tandem_id", convo.id)
      .order("created_at", { ascending: true })
      .then(({ data }: any) => {
        if (cancelled) return;
        setMessages((data ?? []) as ChatMessage[]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
      });

    const channel = supabase
      .channel(`messages-${convo.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `tandem_id=eq.${convo.id}` },
        (payload) => {
          const row = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [convo.id]);

  const sendMessage = async () => {
    const text = message.trim();
    if (!text || !user) return;
    if (!gate.isVerified) {
      gate.showGate();
      return;
    }
    setMessage("");
    // Optimistic: insert into Supabase. Realtime sub will mirror it back; the
    // in-memory dedupe by id prevents duplicates.
    const { data, error } = await supabase
      .from("messages")
      .insert({ tandem_id: convo.id, sender_id: user.id, content: text } as any)
      .select("id, content, sender_id, created_at")
      .maybeSingle();
    if (error) {
      console.warn("[ChatScreen] send failed:", error.message);
      setMessage(text);
      return;
    }
    if (data) {
      const row = data as unknown as ChatMessage;
      setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.teal} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <View style={s.headerAvatarRing}>
            <Image source={{ uri: convo.photo }} style={s.headerAvatar} />
          </View>
          <Text style={s.headerName}>{convo.name}</Text>
        </View>
        <View style={s.headerActions}>
          <TouchableOpacity
            onPress={() => setHelpModalVisible(true)}
            style={s.helpLink}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Text style={s.helpLinkText}>need help</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onSendSpot}
            style={s.contextPill}
            activeOpacity={0.8}
          >
            <Ionicons name="location" size={11} color={colors.teal} />
            <Text style={s.contextText}>send spot</Text>
          </TouchableOpacity>
          {isPoster ? (
            <TouchableOpacity
              onPress={() => setOverflowVisible(true)}
              style={s.overflowBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.muted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Active spot share banner */}
      {activeShare ? (
        <View style={s.shareBanner}>
          <Ionicons name="radio" size={14} color={colors.teal} />
          <Text style={s.shareBannerText}>
            {activeShare.sharer_user_id === user?.id
              ? "this tandem's spot is being shared."
              : `${convo.name} sent the spot to a friend.`}
          </Text>
          {activeShare.sharer_user_id === user?.id ? (
            <TouchableOpacity onPress={endActiveShare} activeOpacity={0.7}>
              <Text style={s.shareEndLink}>end share</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={s.messages}
        contentContainerStyle={[s.messagesContent, { paddingBottom: 20 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Matched header */}
        <View style={s.matchedBanner}>
          <View style={s.matchedAvatarWrap}>
            <Image source={{ uri: convo.photo }} style={s.matchedAvatar} />
            <View style={s.matchedBadge}>
              <Ionicons name="checkmark" size={10} color={colors.white} />
            </View>
          </View>
          <Text style={s.matchedName}>{convo.name}</Text>
          <Text style={s.matchedHint}>you're both in. coordinate the details.</Text>
        </View>

        {/* Empty state — chat exists but no messages yet */}
        {messages.length === 0 && (
          <Text style={s.emptySunnyLine}>fresh chat. say hey.</Text>
        )}

        {/* Message bubbles */}
        {messages.map(m => {
          const sent = m.sender_id === user?.id;
          return (
            <View key={m.id} style={[s.bubbleRow, sent && s.bubbleRowSent]}>
              {sent ? (
                <LinearGradient
                  colors={gradients.brand}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[s.bubble, s.bubbleSent]}
                >
                  <Text style={s.bubbleTextSent}>{m.content}</Text>
                </LinearGradient>
              ) : (
                <View style={[s.bubble, s.bubbleReceived]}>
                  <Text style={s.bubbleTextReceived}>{m.content}</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Input bar */}
      <View style={[s.inputBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TextInput
          style={s.input}
          placeholder={`message ${convo.name}...`}
          placeholderTextColor={colors.muted}
          value={message}
          onChangeText={setMessage}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
          multiline
        />
        <TouchableOpacity
          style={[s.sendBtn, !message.trim() && s.sendBtnDisabled]}
          activeOpacity={message.trim() ? 0.88 : 1}
          onPress={sendMessage}
          disabled={!message.trim()}
        >
          <LinearGradient
            colors={message.trim() ? gradients.brand : ["#E5E7EB", "#E5E7EB"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.sendBtnInner}
          >
            <Ionicons
              name="arrow-up"
              size={18}
              color={message.trim() ? colors.white : colors.muted}
            />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <VerificationGateModal
        visible={gate.gateVisible}
        hasSelfieUploaded={gate.hasSelfieUploaded}
        onClose={gate.hideGate}
        onTakeSelfie={onTakeSelfie}
      />

      <Modal
        visible={overflowVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setOverflowVisible(false)}
      >
        <Pressable
          style={h.backdrop}
          onPress={() => setOverflowVisible(false)}
        >
          <Pressable style={h.card} onPress={(e) => e.stopPropagation()}>
            <Text style={h.title}>{convo.name}</Text>
            <TouchableOpacity
              onPress={() => {
                setOverflowVisible(false);
                setRemoveConfirmVisible(true);
              }}
              activeOpacity={0.7}
              style={overflowS.menuRow}
            >
              <Ionicons name="person-remove-outline" size={18} color={colors.destructive} />
              <Text style={overflowS.menuRowText}>Remove from tandem</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setOverflowVisible(false);
                setBlockConfirmVisible(true);
              }}
              activeOpacity={0.7}
              style={overflowS.menuRow}
            >
              <Ionicons name="ban-outline" size={18} color={colors.destructive} />
              <Text style={overflowS.menuRowText}>Block user</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                setOverflowVisible(false);
                if (!user || !tandemContext.partnerId) return;
                await supabase.from("user_reports").insert({
                  reporter_id: user.id,
                  reported_user_id: tandemContext.partnerId,
                  tandem_id: convo.id,
                  activity_id: tandemContext.activityId,
                  reason: "reported from chat",
                } as any);
                try {
                  await supabase.functions.invoke("update-trust-tier", {
                    body: { user_id: tandemContext.partnerId, trigger: "report" },
                  });
                } catch { /* non-blocking */ }
                Alert.alert("report submitted.");
              }}
              activeOpacity={0.7}
              style={overflowS.menuRow}
            >
              <Ionicons name="flag-outline" size={18} color={colors.destructive} />
              <Text style={overflowS.menuRowText}>Report</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setOverflowVisible(false)}
              activeOpacity={0.7}
              style={h.cancelBtn}
            >
              <Text style={h.cancelBtnText}>cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={removeConfirmVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setRemoveConfirmVisible(false)}
      >
        <Pressable
          style={h.backdrop}
          onPress={() => setRemoveConfirmVisible(false)}
        >
          <Pressable style={h.card} onPress={(e) => e.stopPropagation()}>
            <Text style={h.title}>Remove {convo.name} from this tandem?</Text>
            <Text style={h.body}>
              They won't be in this tandem anymore. They'll get a brief notification but no details. You can still see each other on Tandem.
            </Text>
            <TouchableOpacity
              onPress={handleRemoveFromTandem}
              disabled={removing}
              activeOpacity={0.88}
              style={overflowS.removeBtn}
            >
              <LinearGradient
                colors={["#DC2626", "#B91C1C"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={overflowS.removeBtnInner}
              >
                <Text style={overflowS.removeBtnText}>
                  {removing ? "Removing..." : "Remove"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setRemoveConfirmVisible(false)}
              activeOpacity={0.7}
              style={h.cancelBtn}
            >
              <Text style={h.cancelBtnText}>cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={blockConfirmVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setBlockConfirmVisible(false)}
      >
        <Pressable
          style={h.backdrop}
          onPress={() => setBlockConfirmVisible(false)}
        >
          <Pressable style={h.card} onPress={(e) => e.stopPropagation()}>
            <Text style={h.title}>Block {convo.name}?</Text>
            <Text style={h.body}>
              They'll be removed from this tandem and you won't see each other on Tandem anywhere.
            </Text>
            <TouchableOpacity
              onPress={handleBlockUser}
              disabled={blocking}
              activeOpacity={0.88}
              style={overflowS.removeBtn}
            >
              <LinearGradient
                colors={["#DC2626", "#B91C1C"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={overflowS.removeBtnInner}
              >
                <Text style={overflowS.removeBtnText}>
                  {blocking ? "Blocking..." : "Block"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setBlockConfirmVisible(false)}
              activeOpacity={0.7}
              style={h.cancelBtn}
            >
              <Text style={h.cancelBtnText}>cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <EmergencyConfirmModal
        visible={helpModalVisible}
        onCancel={() => setHelpModalVisible(false)}
        onConfirm={handleNeedHelp}
      />
    </KeyboardAvoidingView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, alignItems: "flex-start", justifyContent: "center" },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerAvatarRing: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2, borderColor: colors.teal, overflow: "hidden",
  },
  headerAvatar: { width: "100%", height: "100%", borderRadius: 16 },
  headerName: { fontSize: 16, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground },
  contextPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.tintTeal, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  contextText: { fontSize: 11, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.teal },

  // Messages
  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 16, paddingTop: 20, gap: 10 },
  matchedBanner: { alignItems: "center", gap: 8, marginBottom: 24 },
  matchedAvatarWrap: { position: "relative" },
  matchedAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface },
  matchedBadge: {
    position: "absolute", bottom: 0, right: 0,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.teal, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.white,
  },
  matchedName: { fontSize: 17, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground },
  matchedHint: { fontSize: 13, color: colors.muted },

  // Bubbles
  bubbleRow: { flexDirection: "row", alignItems: "flex-end" },
  bubbleRowSent: { justifyContent: "flex-end" },
  bubble: { maxWidth: "75%", paddingHorizontal: 14, paddingVertical: 10 },
  bubbleSent: {
    borderRadius: 18, borderBottomRightRadius: 4,
  },
  bubbleReceived: {
    borderRadius: 18, borderBottomLeftRadius: 4,
    backgroundColor: colors.white,
    borderWidth: 1.5, borderColor: colors.border,
  },
  bubbleTextSent: { fontSize: 15, color: colors.white, lineHeight: 21 },
  bubbleTextReceived: { fontSize: 15, color: colors.foreground, lineHeight: 21 },
  emptySunnyLine: {
    fontSize: 18,
    color: "#1F2937",
    fontFamily: "Fraunces_500Medium_Italic",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 32,
  },

  // Input
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    paddingHorizontal: 16, paddingTop: 10,
    backgroundColor: colors.white,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  input: {
    flex: 1, backgroundColor: colors.background, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: 16, paddingVertical: 11,
    fontSize: 15, color: colors.foreground, maxHeight: 120,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, overflow: "hidden", ...shadows.brand },
  sendBtnDisabled: { shadowOpacity: 0 },
  sendBtnInner: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Header actions row
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  overflowBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  helpLink: { paddingHorizontal: 6, paddingVertical: 4 },
  helpLinkText: {
    fontSize: 12,
    color: "#B45309",
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  // Spot share banner
  shareBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.tintTeal,
    borderBottomWidth: 1,
    borderBottomColor: colors.teal + "44",
  },
  shareBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.secondary,
    fontFamily: "Quicksand_500Medium",
  },
  shareEndLink: {
    fontSize: 13,
    color: colors.teal,
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});

const h = StyleSheet.create({
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
  },
  title: {
    fontSize: 22,
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
    marginBottom: 18,
  },
  cancelBtn: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    color: colors.muted,
    fontFamily: "Quicksand_500Medium",
  },
});

const overflowS = StyleSheet.create({
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuRowText: {
    fontSize: 15,
    color: colors.destructive,
    fontFamily: "Quicksand_600SemiBold",
    fontWeight: "600",
  },
  removeBtn: {
    borderRadius: radius.full,
    overflow: "hidden",
  },
  removeBtnInner: {
    paddingVertical: 14,
    alignItems: "center",
  },
  removeBtnText: {
    fontSize: 15,
    color: colors.white,
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
  },
});
