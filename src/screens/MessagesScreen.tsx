import React from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SunnyAvatar from "../components/SunnyAvatar";
import { colors, radius, shadows } from "../theme";

export interface Conversation {
  id: string;
  name: string;
  age: number;
  photo: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
}

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "1",
    name: "Jamie",
    age: 28,
    photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face",
    lastMessage: "That hike was unreal. Same time next week?",
    timestamp: "2h ago",
    unread: true,
  },
  {
    id: "2",
    name: "Alex",
    age: 31,
    photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face",
    lastMessage: "The Blue Whale never disappoints.",
    timestamp: "Yesterday",
    unread: false,
  },
  {
    id: "3",
    name: "Sam",
    age: 26,
    photo: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&h=200&fit=crop&crop=face",
    lastMessage: "Down for volleyball Sunday?",
    timestamp: "2d ago",
    unread: false,
  },
];

interface MessagesScreenProps {
  onBack: () => void;
  onOpenChat: (convo: { id: string; name: string; photo: string }) => void;
}

export const MessagesScreen = ({ onBack, onOpenChat }: MessagesScreenProps) => {
  const insets = useSafeAreaInsets();
  const conversations = MOCK_CONVERSATIONS;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.teal} />
        </TouchableOpacity>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={s.title}>messages</Text>
          <Text style={{ fontFamily: 'System', fontSize: 22 }}>💬</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {conversations.length === 0 ? (
        <View style={s.empty}>
          <SunnyAvatar expression="warm" size={60} />
          <Text style={s.emptyTitle}>no messages yet.</Text>
          <Text style={s.emptyDesc}>conversations start here when you connect on an activity.</Text>
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
  title: { fontSize: 22, fontWeight: "800", color: colors.foreground, letterSpacing: -0.4 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingBottom: 80 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: colors.foreground },
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
  name: { fontSize: 15, fontWeight: "500", color: colors.foreground },
  nameUnread: { fontWeight: "700" },
  time: { fontSize: 12, color: colors.muted },
  preview: { fontSize: 14, color: colors.muted, lineHeight: 18 },
  previewUnread: { color: colors.secondary, fontWeight: "500" },
});
