import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFonts, Fraunces_500Medium_Italic, Fraunces_700Bold_Italic } from "@expo-google-fonts/fraunces";
import SunnyAvatar from "../components/SunnyAvatar";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { colors, radius } from "../theme";

interface NotificationRow {
  id: string;
  user_id: string;
  type: string | null;
  title: string | null;
  body: string | null;
  data: any;
  read: boolean | null;
  created_at: string;
}

interface NotificationsScreenProps {
  onBack: () => void;
  onOpenChat?: (convo: { id: string; name: string; photo: string }) => void;
  onOpenActivity?: (activityId: string) => void;
}

const SYSTEM_TYPES = new Set([
  "system",
  "weekly_checkin",
  "activity_reminder",
  "birthday",
  "verification_approved",
  "verification_rejected",
]);

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const NotificationsScreen = ({ onBack, onOpenChat, onOpenActivity }: NotificationsScreenProps) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  useFonts({ Fraunces_500Medium_Italic, Fraunces_700Bold_Italic });
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRows = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("notifications")
      .select("id, user_id, type, title, body, data, read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setRows((data ?? []) as NotificationRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRows();
    setRefreshing(false);
  }, [fetchRows]);

  const handleRowPress = async (row: NotificationRow) => {
    // Optimistic mark-as-read
    if (!row.read) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, read: true } : r)));
      await supabase.from("notifications").update({ read: true } as any).eq("id", row.id);
    }
    // Route based on type
    const data = row.data ?? {};
    if (row.type === "new_message" && data.tandem_id && onOpenChat) {
      onOpenChat({
        id: data.tandem_id,
        name: data.sender_name ?? "tandem",
        photo: data.sender_photo ?? "",
      });
      return;
    }
    if ((row.type === "join_request" || row.type === "request_accepted") && data.activity_id && onOpenActivity) {
      onOpenActivity(data.activity_id);
      return;
    }
    // Other types: stay on the inbox after marking read.
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.teal} />
          <Text style={s.backText}>back</Text>
        </TouchableOpacity>
        <Text style={s.title}>notifications</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.teal} />
        </View>
      ) : rows.length === 0 ? (
        <View style={s.empty}>
          <SunnyAvatar expression="warm" size={84} />
          <Text style={s.emptySunnyLine}>nothing yet. but soon.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.teal} />
          }
        >
          {rows.map((r) => {
            const isUnread = !r.read;
            const senderPhoto = r.data?.sender_photo as string | undefined;
            const isSystem = !r.type || SYSTEM_TYPES.has(r.type);
            return (
              <TouchableOpacity
                key={r.id}
                onPress={() => handleRowPress(r)}
                activeOpacity={0.85}
                style={[s.row, isUnread && s.rowUnread]}
              >
                {isUnread && <View style={s.unreadBar} />}
                <View style={s.avatarWrap}>
                  {!isSystem && senderPhoto ? (
                    <Image source={{ uri: senderPhoto }} style={s.avatar} />
                  ) : (
                    <View style={s.sunnyAvatarWrap}>
                      <SunnyAvatar expression="warm" size={40} />
                    </View>
                  )}
                </View>
                <View style={s.body}>
                  {r.title ? (
                    <Text style={s.rowTitle} numberOfLines={1}>{r.title}</Text>
                  ) : null}
                  {r.body ? (
                    <Text style={s.rowBody} numberOfLines={2}>{r.body}</Text>
                  ) : null}
                </View>
                <Text style={s.timestamp}>{formatRelative(r.created_at)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2, width: 60 },
  backText: { fontSize: 14, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.teal },
  title: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Quicksand_700Bold",
    color: colors.foreground,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 32,
  },
  emptySunnyLine: {
    fontSize: 22,
    color: "#1F2937",
    fontFamily: "Fraunces_500Medium_Italic",
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 28,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowUnread: { backgroundColor: "#F0FDFB" },
  unreadBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.teal,
  },
  avatarWrap: { width: 40, height: 40 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface },
  sunnyAvatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF7E6",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  body: { flex: 1, gap: 2 },
  rowTitle: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Quicksand_700Bold",
    color: "#1F2937",
  },
  rowBody: {
    fontSize: 13,
    fontFamily: "Quicksand_500Medium",
    color: "#6B7280",
    lineHeight: 18,
  },
  timestamp: {
    fontSize: 11,
    fontFamily: "Quicksand_500Medium",
    color: colors.muted,
    marginLeft: 4,
  },
});
