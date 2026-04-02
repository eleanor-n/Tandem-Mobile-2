import React, { useRef, useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Modal, Linking, Alert,
} from "react-native";
import { TermsScreen } from "./TermsScreen";
import { PrivacyScreen } from "./PrivacyScreen";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { colors, radius, shadows, gradients } from "../theme";

interface SettingsScreenProps {
  onBack: () => void;
  onMembershipPress?: () => void;
}

const ChevronRight = () => <Ionicons name="chevron-forward" size={16} color={colors.muted} />;
const LockIcon = () => <Ionicons name="lock-closed-outline" size={15} color={colors.muted} />;
const CheckIcon = () => <Ionicons name="checkmark" size={16} color={colors.teal} />;

const VISIBILITY_FIELDS = [
  { key: "gender", label: "Gender" },
  { key: "sexuality", label: "Sexuality" },
  { key: "religion", label: "Religion" },
  { key: "relationship_status", label: "Relationship Status" },
  { key: "occupation", label: "Job / Occupation" },
  { key: "mbti", label: "Personality Type" },
  { key: "humor_type", label: "Humor Type" },
  { key: "purpose", label: "Looking For" },
];

const MEMBERSHIP_FEATURES = [
  { label: "Browse activities", free: true, go: true, trail: true },
  { label: "I'm In (5/month)", free: true, go: true, trail: true },
  { label: "Unlimited I'm In's", free: false, go: true, trail: true },
  { label: "See who viewed you", free: false, go: true, trail: true },
  { label: "Advanced filters", free: false, go: true, trail: true },
  { label: "Scrapbook", free: false, go: true, trail: true },
  { label: "Priority matching", free: false, go: true, trail: true },
  { label: "Priority support", free: false, go: true, trail: false },
  { label: "Trail adventures", free: false, go: false, trail: true },
];

export const SettingsScreen = ({ onBack, onMembershipPress }: SettingsScreenProps) => {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [membershipTier, setMembershipTier] = useState("Free");
  const [whoToSee, setWhoToSee] = useState("Everyone");
  const [visibility, setVisibility] = useState<Record<string, boolean>>({
    gender: true, sexuality: true, religion: true,
    relationship_status: true, occupation: true, mbti: true, humor_type: true, purpose: true,
  });

  const [showDiscovery, setShowDiscovery] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showMembership, setShowMembership] = useState(false);
  const [showLinkedAccounts, setShowLinkedAccounts] = useState(false);
  const [showTermsScreen, setShowTermsScreen] = useState(false);
  const [showPrivacyScreen, setShowPrivacyScreen] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  };

  // All hooks must be declared before any conditional returns
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles")
      .select("notification_preferences, membership_tier, who_to_see, profile_visibility")
      .eq("user_id", user.id).single()
      .then(({ data }) => {
        if (data?.notification_preferences?.push_enabled !== undefined) {
          setNotificationsEnabled(data.notification_preferences.push_enabled);
        }
        if (data?.membership_tier) {
          setMembershipTier(data.membership_tier === "go" ? "Tandem Go" : data.membership_tier === "trail" ? "Trail" : "Free");
        }
        if (data?.who_to_see) setWhoToSee(data.who_to_see);
        if (data?.profile_visibility) setVisibility(prev => ({ ...prev, ...(data.profile_visibility as Record<string, boolean>) }));
      });
  }, [user]);

  const handleNotificationsToggle = async (val: boolean) => {
    setNotificationsEnabled(val);
    if (user) await supabase.from("profiles").update({ notification_preferences: { push_enabled: val } } as any).eq("user_id", user.id);
  };

  const handleWhoToSee = async (val: string) => {
    setWhoToSee(val);
    if (user) await supabase.from("profiles").update({ who_to_see: val } as any).eq("user_id", user.id);
  };

  const handleVisibilityToggle = async (key: string) => {
    const updated = { ...visibility, [key]: !visibility[key] };
    setVisibility(updated);
    if (user) await supabase.from("profiles").update({ profile_visibility: updated } as any).eq("user_id", user.id);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all your data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (user) {
                await supabase.functions.invoke("delete-account", {
                  body: { user_id: user.id },
                });
              }
              await signOut();
            } catch {
              showToast("something went wrong. contact tandemapp.hq@gmail.com to delete your account.");
            }
          },
        },
      ]
    );
  };

  const backChevron = <Ionicons name="chevron-back" size={22} color={colors.teal} />;

  if (showTermsScreen) {
    return <TermsScreen onBack={() => { setShowTermsScreen(false); setShowPrivacyScreen(false); }} />;
  }
  if (showPrivacyScreen) {
    return <PrivacyScreen onBack={() => { setShowPrivacyScreen(false); setShowTermsScreen(false); }} />;
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          {backChevron}
          <Text style={s.backText}>Profile</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settings</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.content, { paddingBottom: 60 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* PREFERENCES */}
        <Text style={s.sectionLabel}>PREFERENCES</Text>
        <View style={s.card}>
          <View style={s.row}>
            <Text style={s.rowLabel}>Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              trackColor={{ false: colors.border, true: colors.teal }}
              thumbColor={colors.white}
            />
          </View>
          <View style={s.divider} />
          <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={() => setShowDiscovery(true)}>
            <Text style={s.rowLabel}>Discovery</Text>
            <View style={s.rowRight}>
              <Text style={s.rowValue}>{whoToSee}</Text>
              <ChevronRight />
            </View>
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={() => setShowPrivacy(true)}>
            <Text style={s.rowLabel}>Privacy</Text>
            <ChevronRight />
          </TouchableOpacity>
        </View>

        {/* ACCOUNT */}
        <Text style={s.sectionLabel}>ACCOUNT</Text>
        <View style={s.card}>
          <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={() => setShowMembership(true)}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={s.rowLabel}>Membership</Text>
              <View style={membershipTier === "Free" ? s.freeBadge : s.goBadge}>
                <Text style={membershipTier === "Free" ? s.freeBadgeText : s.goBadgeText}>{membershipTier}</Text>
              </View>
            </View>
            <ChevronRight />
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={() => setShowLinkedAccounts(true)}>
            <Text style={s.rowLabel}>Linked Accounts</Text>
            <ChevronRight />
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={async () => {
            try {
              await Linking.openURL("mailto:tandemapp.hq@gmail.com?subject=Tandem%20App%20Feedback");
            } catch {
              Alert.alert("Contact us", "Reach us at tandemapp.hq@gmail.com");
            }
          }}>
            <Text style={s.rowLabel}>Help & Feedback</Text>
            <ChevronRight />
          </TouchableOpacity>
        </View>

        {/* SUPPORT */}
        <Text style={s.sectionLabel}>SUPPORT</Text>
        <View style={s.card}>
          <View style={[s.row, { opacity: 0.5 }]}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={s.rowLabel}>Priority Support</Text>
              <View style={s.goBadge}>
                <Text style={s.goBadgeText}>Tandem Go</Text>
              </View>
            </View>
            <LockIcon />
          </View>
        </View>

        {/* LEGAL */}
        <Text style={s.sectionLabel}>LEGAL</Text>
        <View style={s.card}>
          <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={() => setShowTermsScreen(true)}>
            <Text style={s.rowLabel}>Terms of Service</Text>
            <ChevronRight />
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={() => setShowPrivacyScreen(true)}>
            <Text style={s.rowLabel}>Privacy Policy</Text>
            <ChevronRight />
          </TouchableOpacity>
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={s.signOutBtn} onPress={signOut} activeOpacity={0.85}>
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity style={s.deleteBtn} onPress={handleDeleteAccount} activeOpacity={0.85}>
          <Text style={s.deleteText}>Delete Account</Text>
        </TouchableOpacity>

        <Text style={s.version}>Tandem v1.0.0</Text>
      </ScrollView>

      {/* ── Discovery Modal ─────────────────────────────────── */}
      <Modal visible={showDiscovery} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowDiscovery(false)}>
        <View style={m.container}>
          <View style={m.handle} />
          <View style={m.header}>
            <TouchableOpacity onPress={() => setShowDiscovery(false)} style={s.backBtn} activeOpacity={0.7}>
              {backChevron}
              <Text style={s.backText}>Settings</Text>
            </TouchableOpacity>
            <Text style={m.title}>Discovery</Text>
            <View style={{ width: 70 }} />
          </View>
          <ScrollView contentContainerStyle={m.content}>
            <Text style={m.desc}>Choose who you want to discover on Tandem.</Text>
            {["Man", "Woman", "Everyone"].map(opt => (
              <TouchableOpacity key={opt} style={[m.option, whoToSee === opt && m.optionSelected]}
                onPress={() => handleWhoToSee(opt)} activeOpacity={0.8}>
                <Text style={[m.optionText, whoToSee === opt && m.optionTextSelected]}>{opt}</Text>
                {whoToSee === opt && <CheckIcon />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Privacy Modal ────────────────────────────────────── */}
      <Modal visible={showPrivacy} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPrivacy(false)}>
        <View style={m.container}>
          <View style={m.handle} />
          <View style={m.header}>
            <TouchableOpacity onPress={() => setShowPrivacy(false)} style={s.backBtn} activeOpacity={0.7}>
              {backChevron}
              <Text style={s.backText}>Settings</Text>
            </TouchableOpacity>
            <Text style={m.title}>Privacy</Text>
            <View style={{ width: 70 }} />
          </View>
          <ScrollView contentContainerStyle={m.content}>
            <Text style={m.desc}>Toggle off anything you don't want shown on your public profile.</Text>
            <View style={s.card}>
              {VISIBILITY_FIELDS.map(({ key, label }, i) => (
                <View key={key}>
                  {i > 0 && <View style={s.divider} />}
                  <View style={s.row}>
                    <Text style={s.rowLabel}>{label}</Text>
                    <Switch
                      value={visibility[key] ?? true}
                      onValueChange={() => handleVisibilityToggle(key)}
                      trackColor={{ false: colors.border, true: colors.teal }}
                      thumbColor={colors.white}
                    />
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Membership Modal ─────────────────────────────────── */}
      <Modal visible={showMembership} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowMembership(false)}>
        <View style={m.container}>
          <View style={m.handle} />
          <View style={m.header}>
            <TouchableOpacity onPress={() => setShowMembership(false)} style={s.backBtn} activeOpacity={0.7}>
              {backChevron}
              <Text style={s.backText}>Settings</Text>
            </TouchableOpacity>
            <Text style={m.title}>Membership</Text>
            <View style={{ width: 70 }} />
          </View>
          <ScrollView contentContainerStyle={m.content} showsVerticalScrollIndicator={false}>
            {/* Tier header row */}
            <View style={mem.tierRow}>
              <View style={mem.featureCol} />
              {["Free", "Go", "Trail"].map(tier => (
                <View key={tier} style={[mem.tierCol, membershipTier === tier && mem.tierColActive]}>
                  <Text style={[mem.tierLabel, membershipTier === tier && mem.tierLabelActive]}>{tier}</Text>
                  {membershipTier === tier && <View style={mem.activeDot} />}
                </View>
              ))}
            </View>
            {/* Feature rows */}
            {MEMBERSHIP_FEATURES.map((f, i) => (
              <View key={f.label} style={[mem.featureRow, i % 2 === 1 && mem.featureRowAlt]}>
                <View style={mem.featureCol}><Text style={mem.featureText}>{f.label}</Text></View>
                {([f.free, f.go, f.trail] as boolean[]).map((has, j) => (
                  <View key={j} style={mem.tierCol}>
                    {has
                      ? <View style={mem.check}><Ionicons name="checkmark" size={13} color={colors.teal} /></View>
                      : <View style={mem.lock}><Ionicons name="lock-closed-outline" size={13} color={colors.muted} /></View>
                    }
                  </View>
                ))}
              </View>
            ))}
            {/* Upgrade CTA */}
            {membershipTier === "Free" && (
              <TouchableOpacity style={mem.upgradeBtn} activeOpacity={0.88} onPress={() => { setShowMembership(false); onMembershipPress?.(); }}>
                <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={mem.upgradeBtnInner}>
                  <Text style={mem.upgradeBtnText}>Upgrade to Tandem Go</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>

      {!!toast && (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}


      {/* ── Linked Accounts Modal ────────────────────────────── */}
      <Modal visible={showLinkedAccounts} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowLinkedAccounts(false)}>
        <View style={m.container}>
          <View style={m.handle} />
          <View style={m.header}>
            <TouchableOpacity onPress={() => setShowLinkedAccounts(false)} style={s.backBtn} activeOpacity={0.7}>
              {backChevron}
              <Text style={s.backText}>Settings</Text>
            </TouchableOpacity>
            <Text style={m.title}>Linked Accounts</Text>
            <View style={{ width: 70 }} />
          </View>
          <ScrollView contentContainerStyle={m.content}>
            <Text style={m.desc}>Accounts connected to your Tandem profile.</Text>
            <View style={s.card}>
              <View style={s.row}>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={linked.googleIcon}>
                    <Text style={linked.googleG}>G</Text>
                  </View>
                  <View>
                    <Text style={s.rowLabel}>Google</Text>
                    <Text style={linked.connectedText}>{user?.email ?? "connected"}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert("Unlink Google", "Are you sure you want to unlink your Google account?", [
                      { text: "Cancel", style: "cancel" },
                      { text: "Unlink", style: "destructive", onPress: () => showToast("google account unlinked.") },
                    ]);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={linked.unlinkText}>Unlink</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const linked = StyleSheet.create({
  googleIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#F0F4FF", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#D0D8F0",
  },
  googleG: { fontSize: 15, fontWeight: "700", color: "#4285F4" },
  connectedText: { fontSize: 12, color: colors.muted, marginTop: 1 },
  unlinkText: { fontSize: 13, fontWeight: "600", color: "#DC2626" },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 14,
    backgroundColor: "rgba(249,246,242,0.97)",
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, width: 70 },
  backText: { fontSize: 14, fontWeight: "600", color: colors.teal },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.foreground, letterSpacing: -0.3 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, gap: 4 },
  sectionLabel: {
    fontSize: 10, fontWeight: "700", color: colors.muted,
    letterSpacing: 1.2, marginTop: 16, marginBottom: 6, marginLeft: 4,
  },
  card: {
    backgroundColor: colors.white, borderRadius: radius.lg,
    ...shadows.card, borderWidth: 1, borderColor: colors.border,
  },
  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 16,
  },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowLabel: { fontSize: 15, color: colors.foreground, fontWeight: "500" },
  rowValue: { fontSize: 14, color: colors.muted },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
  freeBadge: { backgroundColor: colors.surface, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  freeBadgeText: { fontSize: 11, fontWeight: "600", color: colors.muted },
  goBadge: { backgroundColor: colors.tintTeal, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  goBadgeText: { fontSize: 11, fontWeight: "600", color: colors.teal },
  signOutBtn: {
    marginTop: 24, height: 52, borderRadius: radius.full,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: "#DC2626",
    alignItems: "center", justifyContent: "center", ...shadows.card,
  },
  signOutText: { fontSize: 15, fontWeight: "600", color: "#DC2626" },
  deleteBtn: {
    marginTop: 8, height: 52, borderRadius: radius.full,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.muted,
    alignItems: "center", justifyContent: "center", ...shadows.card,
  },
  deleteText: { fontSize: 15, fontWeight: "600", color: colors.muted },
  version: { fontSize: 11, color: colors.muted, textAlign: "center", marginTop: 16 },

  toast: {
    position: "absolute", bottom: 60, alignSelf: "center",
    backgroundColor: "rgba(30,30,30,0.82)", borderRadius: radius.full,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  toastText: { fontSize: 13, color: colors.white, fontWeight: "500" },
});

// Shared modal styles
const m = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  handle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginTop: 12 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: "700", color: colors.foreground, letterSpacing: -0.3 },
  content: { padding: 20, gap: 16, paddingBottom: 60 },
  desc: { fontSize: 14, color: colors.muted, lineHeight: 20, marginBottom: 4 },
  option: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 16, paddingHorizontal: 16,
    backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.border, ...shadows.card,
  },
  optionSelected: { borderColor: colors.teal, backgroundColor: colors.tintTeal },
  optionText: { fontSize: 15, fontWeight: "500", color: colors.foreground },
  optionTextSelected: { color: colors.teal, fontWeight: "600" },
  // Terms
  updated: { fontSize: 12, color: colors.muted },
  section: { gap: 6 },
  heading: { fontSize: 14, fontWeight: "700", color: colors.foreground },
  body: { fontSize: 14, color: colors.muted, lineHeight: 22 },
});

// Membership table styles
const mem = StyleSheet.create({
  tierRow: { flexDirection: "row", marginBottom: 4 },
  featureCol: { flex: 2.2 },
  tierCol: { flex: 1, alignItems: "center", paddingVertical: 8 },
  tierColActive: { backgroundColor: colors.tintTeal, borderRadius: radius.lg },
  tierLabel: { fontSize: 13, fontWeight: "700", color: colors.muted },
  tierLabelActive: { color: colors.teal },
  activeDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.teal, marginTop: 3 },
  featureRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  featureRowAlt: { backgroundColor: colors.surface, borderRadius: radius.md },
  featureText: { fontSize: 13, color: colors.foreground, flex: 1 },
  check: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.tintTeal, alignItems: "center", justifyContent: "center" },
  lock: { alignItems: "center", gap: 1, opacity: 0.4 },
  upgradeBtn: { marginTop: 8, height: 54, borderRadius: radius.full, overflow: "hidden" },
  upgradeBtnInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  upgradeBtnText: { fontSize: 15, fontWeight: "700", color: colors.white },
});
