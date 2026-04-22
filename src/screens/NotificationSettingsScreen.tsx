// SUPABASE: run this SQL once
// alter table public.profiles
//   add column if not exists notification_preferences jsonb
//   default '{"join_request":true,"accepted":true,"new_message":true,"activity_reminder":true,"weekly_checkin":true,"birthday":true}'::jsonb;

import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Switch, TouchableOpacity, ActivityIndicator, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { colors, radius } from "../theme";

const DEFAULT_PREFS = {
  join_request: true,
  accepted: true,
  new_message: true,
  activity_reminder: true,
  weekly_checkin: true,
  birthday: true,
};

const LABELS: Record<keyof typeof DEFAULT_PREFS, { label: string; sub: string; icon: string }> = {
  join_request:       { label: "someone says i'm in",        sub: "when someone requests to join your activity",  icon: "person-add-outline" },
  accepted:           { label: "your tandem is accepted",    sub: "when a host accepts your join request",         icon: "checkmark-circle-outline" },
  new_message:        { label: "new messages",               sub: "when someone sends you a message",             icon: "chatbubble-outline" },
  activity_reminder:  { label: "activity reminders",         sub: "1 hour before your activity starts",           icon: "alarm-outline" },
  weekly_checkin:     { label: "sunny's weekly check-in",    sub: "a gentle nudge to get out there",              icon: "sunny-outline" },
  birthday:           { label: "birthday messages",          sub: "sunny remembers your birthday",                icon: "gift-outline" },
};

interface NotificationSettingsScreenProps {
  onBack: () => void;
}

export const NotificationSettingsScreen = ({ onBack }: NotificationSettingsScreenProps) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("notification_preferences")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.notification_preferences) {
          setPrefs({ ...DEFAULT_PREFS, ...data.notification_preferences });
        }
        setLoading(false);
      });
  }, [user]);

  const toggle = async (key: keyof typeof DEFAULT_PREFS) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaving(key);
    await supabase
      .from("profiles")
      .update({ notification_preferences: next } as any)
      .eq("user_id", user!.id);
    setSaving(null);
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
      ) : (
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.hint}>toggle which notifications sunny sends you.</Text>
          {(Object.keys(LABELS) as (keyof typeof DEFAULT_PREFS)[]).map(key => {
            const { label, sub, icon } = LABELS[key];
            return (
              <View key={key} style={s.row}>
                <View style={s.iconWrap}>
                  <Ionicons name={icon as any} size={20} color={colors.teal} />
                </View>
                <View style={s.rowText}>
                  <Text style={s.rowLabel}>{label}</Text>
                  <Text style={s.rowSub}>{sub}</Text>
                </View>
                {saving === key
                  ? <ActivityIndicator color={colors.teal} size="small" />
                  : (
                    <Switch
                      value={prefs[key]}
                      onValueChange={() => toggle(key)}
                      trackColor={{ false: colors.border, true: colors.teal }}
                      thumbColor={colors.white}
                    />
                  )}
              </View>
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
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2, width: 60 },
  backText: { fontSize: 14, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.teal },
  title: { fontSize: 18, fontWeight: "800", fontFamily: "Quicksand_700Bold", color: colors.foreground },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48, gap: 4 },
  hint: { fontSize: 13, fontFamily: "Quicksand_400Regular", color: colors.muted, marginBottom: 8, lineHeight: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.white, borderRadius: radius.lg,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F0FDFB", alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.foreground },
  rowSub: { fontSize: 12, fontFamily: "Quicksand_400Regular", color: colors.muted, marginTop: 1 },
});
