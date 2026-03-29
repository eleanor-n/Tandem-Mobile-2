import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Switch, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomNav } from "../components/BottomNav";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { colors, radius, shadows, gradients } from "../theme";

const VISIBILITY_FIELDS = [
  { key: "gender", label: "Gender" },
  { key: "sexuality", label: "Sexuality" },
  { key: "religion", label: "Religion" },
  { key: "relationship_status", label: "Relationship Status" },
  { key: "occupation", label: "Job / Occupation" },
  { key: "mbti", label: "Personality Type" },
  { key: "humor_type", label: "Humor Type" },
];

const PROMPT_LABELS: Record<string, string> = {
  ideal_saturday: "My ideal Saturday",
  friend_who: "I'm the friend who",
  count_on_me: "Count on me to",
  social_battery: "Social battery",
  weekend_vibe: "Weekend vibe",
};

const MOCK_HOSTING = [
  {
    id: "h1",
    title: "chess & espresso",
    date: "tomorrow · 10:00 am",
    open: true,
    spots: 2,
    photo: "https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=300&h=200&fit=crop",
  },
  {
    id: "h2",
    title: "trail run: pine ridge",
    date: "sat · 7:30 am",
    open: false,
    spots: 0,
    photo: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=300&h=200&fit=crop",
  },
];

const MOCK_BEEN_TO = [
  {
    id: "b1",
    title: "flower market walk",
    date: "oct 12, 2025",
    photo: "https://images.unsplash.com/photo-1490750967868-88df5691cc09?w=300&h=200&fit=crop",
  },
  {
    id: "b2",
    title: "summit hike",
    date: "sep 28, 2025",
    photo: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=300&h=200&fit=crop",
  },
];

interface ProfileScreenProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
  onSettingsPress?: () => void;
  onMembershipPress?: () => void;
  onMessagesPress?: () => void;
}

export const ProfileScreen = ({ activeTab, onTabPress, onSettingsPress, onMembershipPress }: ProfileScreenProps) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  };

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).single().then(({ data }) => {
      if (data) {
        setProfile(data);
        setVisibility((data.profile_visibility as Record<string, boolean>) || {
          gender: true, sexuality: true, religion: true,
          relationship_status: true, occupation: true, mbti: true, humor_type: true,
        });
      }
      setLoading(false);
    });
  }, [user]);

  const toggleVisibility = async (key: string) => {
    const updated = { ...visibility, [key]: !(visibility[key] ?? true) };
    setVisibility(updated);
    if (user) await supabase.from("profiles").update({ profile_visibility: updated } as any).eq("user_id", user.id);
  };

  const quickPrompts = profile?.quick_prompts || {};
  const deepPrompts = profile?.deep_prompts || {};

  if (loading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={colors.teal} size="large" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Settings gear — top right */}
      <TouchableOpacity
        style={[s.gearBtn, { top: insets.top + 12 }]}
        onPress={onSettingsPress}
        activeOpacity={0.7}
      >
        <Ionicons name="settings-outline" size={22} color={colors.muted} />
      </TouchableOpacity>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile photo with gradient ring */}
        <View style={s.avatarSection}>
          <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatarRing}>
            <View style={s.avatarGap}>
              <View style={s.avatarInner}>
                {profile?.photos?.[0] ? (
                  <Image source={{ uri: profile.photos[0] }} style={s.avatarImage} />
                ) : (
                  <View style={s.avatarPlaceholder}>
                    <Ionicons name="person" size={40} color={colors.teal} />
                  </View>
                )}
              </View>
            </View>
          </LinearGradient>
          <Text style={s.name}>{profile?.first_name || "Your name"}</Text>
          <View style={s.locationRow}>
            <Ionicons name="location" size={13} color={colors.muted} />
            <Text style={s.location}>{profile?.location_name || "Princeton, NJ"}</Text>
          </View>
        </View>

        {/* Stat pills */}
        <View style={s.statsRow}>
          {[
            { num: "12", label: "activities" },
            { num: "8", label: "companions" },
            { num: "3", label: "hosting" },
          ].map(stat => (
            <View key={stat.label} style={s.statPill}>
              <Text style={s.statNum}>{stat.num}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Bio */}
        {profile?.bio ? (
          <Text style={s.bio}>"{profile.bio}"</Text>
        ) : (
          <Text style={s.bio}>"always looking for a morning trail run or a quiet corner for chess and coffee."</Text>
        )}

        {/* Hosting now */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>HOSTING NOW</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
            {MOCK_HOSTING.map(h => (
              <View key={h.id} style={s.actCard}>
                <Image source={{ uri: h.photo }} style={s.actPhoto} resizeMode="cover" />
                {h.open && (
                  <View style={s.openBadge}>
                    <Text style={s.openText}>open</Text>
                  </View>
                )}
                {h.spots > 0 && (
                  <View style={s.spotsBadge}>
                    <Text style={s.spotsText}>{h.spots} spots</Text>
                  </View>
                )}
                <View style={s.actBody}>
                  <Text style={s.actTitle} numberOfLines={2}>{h.title}</Text>
                  <Text style={s.actDate}>{h.date}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Been to */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>BEEN TO</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
            {MOCK_BEEN_TO.map(b => (
              <View key={b.id} style={[s.actCard, s.beenCard]}>
                <Image source={{ uri: b.photo }} style={s.actPhoto} resizeMode="cover" />
                <View style={s.actBody}>
                  <Text style={s.actTitle} numberOfLines={2}>{b.title}</Text>
                  <Text style={s.actDate}>{b.date}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* About chips from real profile */}
        {(profile?.occupation || profile?.personality_type || profile?.humor_type?.length) && (
          <View style={s.card}>
            <Text style={s.cardLabel}>ABOUT</Text>
            <View style={s.chips}>
              {profile?.occupation && <View style={s.chip}><Text style={s.chipText}>{profile.occupation}</Text></View>}
              {profile?.personality_type && <View style={[s.chip, { backgroundColor: colors.tintBlue }]}><Text style={s.chipText}>{profile.personality_type}</Text></View>}
              {profile?.humor_type?.map((h: string) => <View key={h} style={[s.chip, { backgroundColor: colors.surface }]}><Text style={s.chipText}>{h}</Text></View>)}
            </View>
          </View>
        )}

        {/* Prompts */}
        {Object.entries(quickPrompts).map(([key, value]) => (
          <View key={key} style={s.promptBlock}>
            <Text style={s.promptLabel}>{(PROMPT_LABELS[key] || key).toUpperCase()}</Text>
            <Text style={s.promptAnswer}>"{String(value)}"</Text>
          </View>
        ))}
        {Object.entries(deepPrompts).map(([prompt, answer]) => (
          <View key={prompt} style={s.promptBlock}>
            <Text style={s.promptLabel}>{prompt.toUpperCase()}</Text>
            <Text style={s.promptAnswer}>"{String(answer)}"</Text>
          </View>
        ))}

        {/* Privacy */}
        <TouchableOpacity onPress={() => setShowPrivacy(!showPrivacy)} style={s.privacyToggle} activeOpacity={0.7}>
          <Text style={s.privacyToggleText}>choose what others see</Text>
          <Ionicons name={showPrivacy ? "chevron-up" : "chevron-down"} size={14} color={colors.muted} />
        </TouchableOpacity>
        {showPrivacy && (
          <View style={s.card}>
            <Text style={s.cardLabelSub}>Toggle off anything you don't want shown publicly</Text>
            {VISIBILITY_FIELDS.map(({ key, label }) => (
              <View key={key} style={s.privacyRow}>
                <Text style={s.privacyLabel}>{label}</Text>
                <Switch
                  value={visibility[key] ?? true}
                  onValueChange={() => toggleVisibility(key)}
                  trackColor={{ false: colors.border, true: colors.teal }}
                  thumbColor={colors.white}
                />
              </View>
            ))}
          </View>
        )}

        {/* Edit + Upgrade */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.outlineBtn} activeOpacity={0.85} onPress={() => showToast("editing is almost here.")}>
            <Text style={s.outlineBtnText}>edit profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.upgradeWrap} activeOpacity={0.85} onPress={onMembershipPress}>
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.upgradeInner}>
              <Text style={s.upgradeText}>upgrade</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {!!toast && (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}

      <BottomNav activeTab={activeTab} onTabPress={onTabPress} />
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  gearBtn: { position: "absolute", right: 16, zIndex: 10, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 14 },

  // Avatar section
  avatarSection: { alignItems: "center", gap: 10, paddingTop: 40 },
  avatarRing: { width: 96, height: 96, borderRadius: 48, padding: 2.5 },
  avatarGap: { flex: 1, borderRadius: 46, backgroundColor: colors.white, padding: 3 },
  avatarInner: { flex: 1, borderRadius: 43, backgroundColor: colors.surface, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  avatarImage: { width: "100%", height: "100%" },
  avatarInitial: { fontSize: 32, fontWeight: "700", color: colors.muted },
  avatarPlaceholder: { flex: 1, borderRadius: 43, backgroundColor: "#F0FDFB", alignItems: "center", justifyContent: "center" },
  name: { fontSize: 22, fontWeight: "700", color: colors.foreground, letterSpacing: -0.4 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  location: { fontSize: 13, color: colors.muted, fontWeight: "500" },

  // Stat pills
  statsRow: { flexDirection: "row", justifyContent: "center", gap: 10 },
  statPill: {
    flexDirection: "row", alignItems: "baseline", gap: 5,
    backgroundColor: colors.white, borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1.5, borderColor: colors.border,
    ...shadows.card,
  },
  statNum: { fontSize: 15, fontWeight: "800", color: colors.teal },
  statLabel: { fontSize: 12, color: colors.muted, fontWeight: "500" },

  // Bio
  bio: { fontSize: 14, color: colors.muted, fontStyle: "italic", textAlign: "center", lineHeight: 22, paddingHorizontal: 8 },

  // Section
  section: { gap: 10 },
  sectionLabel: { fontSize: 10, fontWeight: "700", color: colors.muted, letterSpacing: 1.4 },
  hScroll: { gap: 12, paddingBottom: 4 },

  // Activity cards
  actCard: {
    width: 140, backgroundColor: colors.white, borderRadius: radius.md,
    overflow: "hidden", ...shadows.card, borderWidth: 1, borderColor: colors.border,
  },
  beenCard: { opacity: 0.9 },
  actPhoto: { width: "100%", height: 90, backgroundColor: colors.surface },
  actBody: { padding: 10, gap: 3 },
  actTitle: { fontSize: 13, fontWeight: "700", color: colors.foreground, lineHeight: 18 },
  actDate: { fontSize: 11, color: colors.muted },
  openBadge: {
    position: "absolute", top: 8, left: 8,
    backgroundColor: colors.teal, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  openText: { fontSize: 10, fontWeight: "700", color: colors.white },
  spotsBadge: {
    position: "absolute", top: 8, right: 8,
    backgroundColor: "rgba(255,255,255,0.9)", borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  spotsText: { fontSize: 10, fontWeight: "600", color: colors.foreground },

  // Cards / chips
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 16, ...shadows.card, borderWidth: 1, borderColor: colors.border, gap: 10 },
  cardLabel: { fontSize: 10, fontWeight: "700", color: colors.muted, letterSpacing: 1.2 },
  cardLabelSub: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { backgroundColor: colors.tintTeal, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.foreground },

  // Prompts
  promptBlock: { backgroundColor: colors.tintTeal, borderRadius: radius.md, padding: 16, borderLeftWidth: 3, borderLeftColor: colors.teal },
  promptLabel: { fontSize: 10, fontWeight: "700", color: colors.teal, letterSpacing: 1.2, marginBottom: 6 },
  promptAnswer: { fontSize: 15, fontWeight: "500", color: colors.foreground, fontStyle: "italic", lineHeight: 22 },

  // Privacy
  privacyToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 2 },
  privacyToggleText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  privacyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  privacyLabel: { fontSize: 14, color: colors.foreground },

  // Actions
  actionRow: { flexDirection: "row", gap: 12 },
  outlineBtn: { flex: 1, height: 48, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  outlineBtnText: { fontSize: 14, fontWeight: "600", color: colors.foreground },
  upgradeWrap: { flex: 1, height: 48, borderRadius: radius.full, overflow: "hidden", ...shadows.brand },
  upgradeInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  upgradeText: { fontSize: 14, fontWeight: "700", color: colors.white },

  toast: { position: "absolute", bottom: 100, alignSelf: "center", backgroundColor: "rgba(15,23,42,0.85)", borderRadius: radius.full, paddingHorizontal: 20, paddingVertical: 10 },
  toastText: { fontSize: 13, color: colors.white, fontWeight: "500" },
});
