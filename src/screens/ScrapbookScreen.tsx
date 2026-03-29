import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomNav } from "../components/BottomNav";
import SunnyAvatar from "../components/SunnyAvatar";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { colors, radius, shadows, gradients } from "../theme";

const { width: W } = Dimensions.get("window");
const COL_GAP = 10;
const H_PAD = 16;
const COL_W = (W - H_PAD * 2 - COL_GAP) / 2;

// Masonry heights alternate so adjacent cards feel different
const CARD_HEIGHTS = [180, 140, 160, 200, 150, 170, 190, 145];

const MOCK_MEMORIES = [
  {
    id: "1",
    title: "farmer's market 🌿",
    user: "maya",
    photo: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=400&h=500&fit=crop",
  },
  {
    id: "2",
    title: "slow morning ☕",
    user: "maya",
    photo: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=400&fit=crop",
  },
  {
    id: "3",
    title: "morning hike 🥾",
    user: "maya",
    photo: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&h=600&fit=crop",
  },
  {
    id: "4",
    title: "garden harvest 🌱",
    user: "maya",
    photo: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=400&fit=crop",
  },
  {
    id: "5",
    title: "daily yoga 🧘",
    user: "maya",
    photo: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=500&fit=crop",
  },
  {
    id: "6",
    title: "creative flow 🎨",
    user: "maya",
    photo: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=400&h=400&fit=crop",
  },
];

interface ScrapbookScreenProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
  onMembershipPress?: () => void;
}

export const ScrapbookScreen = ({ activeTab, onTabPress, onMembershipPress }: ScrapbookScreenProps) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [tab, setTab] = useState<"mine" | "friends">("mine");
  const [, setSavedActivities] = useState<any[]>([]);
  const [, setLoadingSaved] = useState(false);
  const isGo = true;

  useEffect(() => {
    if (tab !== "mine" || !user) return;
    setLoadingSaved(true);
    (async () => {
      try {
        const { data } = await supabase.from("profiles").select("saved_activities").eq("user_id", user.id).single();
        setSavedActivities((data?.saved_activities as any[]) || []);
      } catch {
        setSavedActivities([]);
      } finally {
        setLoadingSaved(false);
      }
    })();
  }, [tab, user]);

  // Split memories into two columns for masonry
  const leftCol = MOCK_MEMORIES.filter((_, i) => i % 2 === 0);
  const rightCol = MOCK_MEMORIES.filter((_, i) => i % 2 === 1);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={s.headerTitle}>scrapbook</Text>
          <Text style={{ fontFamily: 'System', fontSize: 24 }}>📷</Text>
        </View>
        {/* mine / friends toggle */}
        <View style={s.toggle}>
          {(["mine", "friends"] as const).map(t => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} activeOpacity={0.8} style={s.toggleBtn}>
              {tab === t ? (
                <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.toggleActive}>
                  <Text style={s.toggleActiveText}>{t}</Text>
                </LinearGradient>
              ) : (
                <View style={s.toggleInactive}>
                  <Text style={s.toggleInactiveText}>{t}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {!isGo ? (
        // ── Locked / upgrade state ────────────────────────────
        <ScrollView
          style={s.scroll}
          contentContainerStyle={[s.content, { paddingBottom: 100 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.lockedBody}>
            <SunnyAvatar expression="warm" size={64} />
            <Text style={s.lockedTitle}>your adventures, all in one place.</Text>
            <Text style={s.lockedDesc}>
              upgrade to Tandem Go and every outing gets its own card. your people, your memories — right here.
            </Text>
            <TouchableOpacity style={s.upgradeBtn} activeOpacity={0.88} onPress={onMembershipPress}>
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.upgradeBtnInner}>
                <Text style={s.upgradeBtnText}>Upgrade to Tandem Go</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Preview masonry (faded) */}
          <Text style={s.previewLabel}>WHAT'S WAITING FOR YOU</Text>
          <View style={s.masonryRow}>
            {/* Left col */}
            <View style={s.col}>
              {leftCol.map((m, i) => (
                <View key={m.id} style={[s.masonryCard, { height: CARD_HEIGHTS[i * 2] ?? 160, opacity: 0.35 }]}>
                  <Image source={{ uri: m.photo }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  <View style={s.cardTag}>
                    <Text style={s.cardTagText} numberOfLines={1}>{m.title}</Text>
                  </View>
                </View>
              ))}
            </View>
            {/* Right col */}
            <View style={s.col}>
              {rightCol.map((m, i) => (
                <View key={m.id} style={[s.masonryCard, { height: CARD_HEIGHTS[i * 2 + 1] ?? 150, opacity: 0.35 }]}>
                  <Image source={{ uri: m.photo }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  <View style={s.cardTag}>
                    <Text style={s.cardTagText} numberOfLines={1}>{m.title}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      ) : (
        // ── Unlocked masonry grid ──────────────────────────────
        <ScrollView
          style={s.scroll}
          contentContainerStyle={[s.content, { paddingBottom: 100 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {MOCK_MEMORIES.length === 0 ? (
            <View style={s.empty}>
              <SunnyAvatar expression="warm" size={60} />
              <Text style={s.emptyTitle}>your scrapbook is empty.</Text>
              <Text style={s.emptyDesc}>join an activity and sunny will save the memory here.</Text>
            </View>
          ) : (
            <View style={s.masonryRow}>
              <View style={s.col}>
                {leftCol.map((m, i) => (
                  <MasonryCard key={m.id} memory={m} height={CARD_HEIGHTS[i * 2] ?? 160} />
                ))}
              </View>
              <View style={s.col}>
                {rightCol.map((m, i) => (
                  <MasonryCard key={m.id} memory={m} height={CARD_HEIGHTS[i * 2 + 1] ?? 150} />
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      <BottomNav activeTab={activeTab} onTabPress={onTabPress} />
    </View>
  );
};

const splitEmoji = (text: string): [string, string] => {
  const match = text.match(/^(.*?)\s*([\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}\u{2300}-\u{23FF}].*)$/u);
  return match ? [match[1], match[2]] : [text, ""];
};

const MasonryCard = ({ memory, height }: { memory: typeof MOCK_MEMORIES[0]; height: number }) => {
  const [titleText, titleEmoji] = splitEmoji(memory.title);
  return (
  <View style={[s.masonryCard, { height }]}>
    <Image source={{ uri: memory.photo }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
    {/* Frosted tag at bottom */}
    <View style={s.cardTag}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
        <Text style={s.cardTagText} numberOfLines={1}>{titleText}</Text>
        {titleEmoji ? <Text style={{ fontFamily: 'System', fontSize: 11 }}>{titleEmoji}</Text> : null}
      </View>
    </View>
    {/* User attribution below card */}
    <View style={s.cardMeta}>
      <View style={s.cardMetaAvatar}>
        <Text style={s.cardMetaInitial}>{memory.user[0].toUpperCase()}</Text>
      </View>
      <Text style={s.cardMetaName}>{memory.user}</Text>
    </View>
  </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: colors.foreground, letterSpacing: -0.5 },

  toggle: {
    flexDirection: "row", backgroundColor: colors.surface,
    borderRadius: radius.full, padding: 3,
  },
  toggleBtn: { overflow: "hidden", borderRadius: radius.full },
  toggleActive: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full },
  toggleActiveText: { fontSize: 12, fontWeight: "700", color: colors.white },
  toggleInactive: { paddingHorizontal: 14, paddingVertical: 6 },
  toggleInactiveText: { fontSize: 12, fontWeight: "600", color: colors.muted },

  scroll: { flex: 1 },
  content: { paddingHorizontal: H_PAD, paddingTop: 16, gap: 16 },

  // Masonry
  masonryRow: { flexDirection: "row", gap: COL_GAP },
  col: { flex: 1, gap: COL_GAP },
  masonryCard: {
    width: COL_W, borderRadius: radius.md,
    overflow: "hidden", backgroundColor: colors.surface,
    marginBottom: 4,
  },
  cardTag: {
    position: "absolute", bottom: 8, left: 8, right: 8,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  cardTagText: { fontSize: 11, fontWeight: "700", color: colors.foreground },
  cardMeta: {
    position: "absolute", bottom: -26, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 4,
  },
  cardMetaAvatar: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.tintTeal, alignItems: "center", justifyContent: "center",
  },
  cardMetaInitial: { fontSize: 9, fontWeight: "700", color: colors.teal },
  cardMetaName: { fontSize: 11, color: colors.muted, fontWeight: "500" },

  // Locked state
  lockedBody: { alignItems: "center", gap: 14, paddingTop: 20, paddingBottom: 8 },
  lockedTitle: { fontSize: 18, fontWeight: "700", color: colors.foreground, textAlign: "center", maxWidth: 280, lineHeight: 26 },
  lockedDesc: { fontSize: 14, color: colors.muted, textAlign: "center", maxWidth: 280, lineHeight: 21 },
  upgradeBtn: { width: "100%", height: 52, borderRadius: radius.full, overflow: "hidden", ...shadows.brand },
  upgradeBtnInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  upgradeBtnText: { fontSize: 15, fontWeight: "700", color: colors.white },
  previewLabel: { fontSize: 10, fontWeight: "700", color: colors.muted, letterSpacing: 1.4, alignSelf: "flex-start" },

  // Empty
  empty: { alignItems: "center", paddingTop: 60, gap: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.foreground },
  emptyDesc: { fontSize: 14, color: colors.muted, textAlign: "center", maxWidth: 260, lineHeight: 21 },
});
