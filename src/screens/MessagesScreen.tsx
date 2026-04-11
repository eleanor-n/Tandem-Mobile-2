import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SunnyAvatar from "../components/SunnyAvatar";
import { getSunnyResponse } from "../lib/sunny";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { colors, radius, shadows } from "../theme";

export interface Conversation {
  id: string;
  name: string;
  photo: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
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
  onBack: () => void;
  onOpenChat: (convo: { id: string; name: string; photo: string }) => void;
}

export const MessagesScreen = ({ onBack, onOpenChat }: MessagesScreenProps) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [sunnyEmptyDesc, setSunnyEmptyDesc] = useState("conversations start here when you connect on an activity.");

  useEffect(() => {
    getSunnyResponse({ context: "emptyMessages" }).then(setSunnyEmptyDesc);
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!user) { setLoadingConversations(false); return; }
    try {
      // Fetch tandems involving the current user
      const { data: tandems } = await supabase
        .from("tandems")
        .select("id, user_a_id, user_b_id")
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);

      if (!tandems || tandems.length === 0) {
        setConversations([]);
        setLoadingConversations(false);
        return;
      }

      const partnerIds = tandems.map((t: any) =>
        t.user_a_id === user.id ? t.user_b_id : t.user_a_id
      );

      // Fetch partner profiles and latest messages in parallel
      const [profilesResult, ...messageResults] = await Promise.all([
        supabase.from("profiles").select("user_id, first_name, avatar_url").in("user_id", partnerIds),
        ...tandems.map((t: any) =>
          supabase
            .from("messages")
            .select("content, created_at, sender_id")
            .eq("tandem_id", t.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        ),
      ]);

      const profiles = profilesResult.data ?? [];

      const convos: Conversation[] = tandems
        .map((t: any, i: number) => {
          const partnerId = t.user_a_id === user.id ? t.user_b_id : t.user_a_id;
          const profile = profiles.find((p: any) => p.user_id === partnerId);
          const msg = messageResults[i].data;
          if (!msg) return null; // skip tandems with no messages yet
          return {
            id: t.id,
            name: profile?.first_name ?? "user",
            photo: profile?.avatar_url ?? "",
            lastMessage: msg.content,
            timestamp: formatTimestamp(msg.created_at),
            unread: msg.sender_id !== user.id,
          };
        })
        .filter(Boolean) as Conversation[];

      setConversations(convos);
    } catch {
      setConversations([]);
    } finally {
      setLoadingConversations(false);
    }
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.teal} />
        </TouchableOpacity>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={s.title}>messages</Text>
          <Text style={{ fontSize: 22, fontFamily: undefined }}>{'\u200B'}💬{'\u200B'}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {conversations.length === 0 ? (
        <View style={s.empty}>
          <SunnyAvatar expression="warm" size={60} />
          <Text style={s.emptyTitle}>no messages yet.</Text>
          <Text style={s.emptyDesc}>{sunnyEmptyDesc}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          {conversations.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[s.row, c.unread && s.rowUnread]}
              onPress={() => onOpenChat({ id: c.id, name: c.name, photo: c.photo })}
              activeOpacity={0.85}
            >
              {/* Teal left bar on unread */}
              {c.unread && <View style={s.unreadBar} />}
              <View style={s.avatarWrap}>
                <Image source={{ uri: c.photo }} style={s.avatar} />
                {c.unread && <View style={s.dot} />}
              </View>
              <View style={s.info}>
                <View style={s.nameRow}>
                  <Text style={[s.name, c.unread && s.nameUnread]}>{c.name}</Text>
                  <Text style={s.time}>{c.timestamp}</Text>
                </View>
                <Text style={[s.preview, c.unread && s.previewUnread]} numberOfLines={1}>
                  {c.lastMessage}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backBtn: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "800", fontFamily: "Quicksand_700Bold", color: colors.foreground, letterSpacing: -0.4 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingBottom: 80 },
  emptyTitle: { fontSize: 20, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground },
  emptyDesc: { fontSize: 14, color: colors.muted, textAlign: "center", maxWidth: 260, lineHeight: 20 },

  row: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
    backgroundColor: colors.background,
    gap: 14,
  },
  rowUnread: { backgroundColor: colors.tintTeal },
  unreadBar: {
    position: "absolute", left: 0, top: 0, bottom: 0,
    width: 4, backgroundColor: colors.teal, borderRadius: 2,
  },
  avatarWrap: { position: "relative" },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface },
  dot: {
    position: "absolute", top: 0, right: 0,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: colors.teal, borderWidth: 2, borderColor: colors.background,
  },
  info: { flex: 1 },
  nameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 },
  name: { fontSize: 15, fontWeight: "500", fontFamily: "Quicksand_500Medium", color: colors.foreground },
  nameUnread: { fontWeight: "700", fontFamily: "Quicksand_700Bold" },
  time: { fontSize: 12, color: colors.muted },
  preview: { fontSize: 14, color: colors.muted, lineHeight: 18 },
  previewUnread: { color: colors.secondary, fontWeight: "500", fontFamily: "Quicksand_500Medium" },
});
