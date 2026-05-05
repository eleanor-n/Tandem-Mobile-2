import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { colors, radius, gradients, shadows } from "../theme";

interface AdminReviewScreenProps {
  onBack: () => void;
}

interface PendingReview {
  user_id: string;
  first_name: string | null;
  birthday: string | null;
  avatar_url: string | null;
  selfie_url: string;
  selfie_uploaded_at: string;
  signedSelfieUrl: string | null;
}

const calculateAge = (birthday: string | null): number | null => {
  if (!birthday) return null;
  return Math.floor(
    (Date.now() - new Date(birthday).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
};

export const AdminReviewScreen = ({ onBack }: AdminReviewScreenProps) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user) {
        if (!cancelled) {
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }
      const { data: me } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const admin = !!(me as any)?.is_admin;
      setIsAdmin(admin);
      if (!admin) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("user_id, first_name, birthday, avatar_url, selfie_url, selfie_uploaded_at")
        .not("selfie_url", "is", null)
        .eq("selfie_verified", false)
        .order("selfie_uploaded_at", { ascending: true });
      if (cancelled) return;
      const rows = (data ?? []) as any[];
      const signed = await Promise.all(
        rows.map(async (r) => {
          const { data: sig } = await supabase.storage
            .from("selfies")
            .createSignedUrl(r.selfie_url, 60 * 60);
          return { ...r, signedSelfieUrl: sig?.signedUrl ?? null } as PendingReview;
        })
      );
      if (cancelled) return;
      setReviews(signed);
      setLoading(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleApprove = async (row: PendingReview) => {
    setActingId(row.user_id);
    const { error } = await supabase
      .from("profiles")
      .update({ selfie_verified: true } as any)
      .eq("user_id", row.user_id);
    if (error) {
      Alert.alert("couldn't approve", error.message);
      setActingId(null);
      return;
    }
    try {
      await supabase.functions.invoke("notify-verification-approved", {
        body: { user_id: row.user_id },
      });
    } catch {
      // non-blocking
    }
    setReviews((prev) => prev.filter((r) => r.user_id !== row.user_id));
    setActingId(null);
  };

  const handleReject = async (row: PendingReview) => {
    setActingId(row.user_id);
    await supabase.storage.from("selfies").remove([row.selfie_url]);

    const { data: current } = await supabase
      .from("profiles")
      .select("verification_rejected_count")
      .eq("user_id", row.user_id)
      .maybeSingle();
    const nextCount = ((current as any)?.verification_rejected_count ?? 0) + 1;

    const { error } = await supabase
      .from("profiles")
      .update({
        selfie_url: null,
        selfie_verified: false,
        verification_rejected_count: nextCount,
      } as any)
      .eq("user_id", row.user_id);
    if (error) {
      Alert.alert("couldn't reject", error.message);
      setActingId(null);
      return;
    }
    try {
      await supabase.functions.invoke("notify-verification-rejected", {
        body: { user_id: row.user_id },
      });
    } catch {
      // non-blocking
    }
    setReviews((prev) => prev.filter((r) => r.user_id !== row.user_id));
    setActingId(null);
  };

  const renderHeader = () => (
    <View style={s.header}>
      <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={s.backBtn}>
        <Ionicons name="chevron-back" size={22} color={colors.teal} />
        <Text style={s.backText}>back</Text>
      </TouchableOpacity>
      <Text style={s.title}>review pending</Text>
      <View style={{ width: 60 }} />
    </View>
  );

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        {renderHeader()}
        <View style={s.center}>
          <ActivityIndicator color={colors.teal} />
        </View>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        {renderHeader()}
        <View style={s.center}>
          <Text style={s.placeholderText}>this screen is for admins only.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {renderHeader()}
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {reviews.length === 0 ? (
          <Text style={s.empty}>no pending verifications.</Text>
        ) : (
          reviews.map((r) => {
            const age = calculateAge(r.birthday);
            const acting = actingId === r.user_id;
            return (
              <View key={r.user_id} style={s.card}>
                <View style={s.row}>
                  {r.signedSelfieUrl ? (
                    <Image source={{ uri: r.signedSelfieUrl }} style={s.selfie} />
                  ) : (
                    <View style={[s.selfie, s.selfieMissing]}>
                      <Text style={s.selfieMissingText}>no signed url</Text>
                    </View>
                  )}
                  <View style={s.profileCol}>
                    {r.avatar_url ? (
                      <Image source={{ uri: r.avatar_url }} style={s.avatar} />
                    ) : (
                      <View style={[s.avatar, s.avatarPlaceholder]}>
                        <Text style={s.avatarInitial}>
                          {(r.first_name ?? "?").charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={s.firstName}>{r.first_name ?? "unknown"}</Text>
                    {age !== null ? <Text style={s.ageText}>{age}</Text> : null}
                  </View>
                </View>
                <View style={s.btnRow}>
                  <TouchableOpacity
                    onPress={() => handleReject(r)}
                    disabled={acting}
                    activeOpacity={0.85}
                    style={s.rejectBtn}
                  >
                    <Text style={s.rejectBtnText}>reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleApprove(r)}
                    disabled={acting}
                    activeOpacity={0.88}
                    style={{ flex: 1 }}
                  >
                    <LinearGradient
                      colors={gradients.brand}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={s.approveBtn}
                    >
                      {acting ? (
                        <ActivityIndicator color={colors.white} />
                      ) : (
                        <Text style={s.approveBtnText}>approve</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
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
  title: { fontSize: 18, fontWeight: "800", fontFamily: "Quicksand_700Bold", color: colors.foreground },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  placeholderText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    fontFamily: "Quicksand_400Regular",
  },
  empty: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    fontFamily: "Quicksand_400Regular",
    paddingTop: 32,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  selfie: {
    width: 180,
    height: 220,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  selfieMissing: { alignItems: "center", justifyContent: "center" },
  selfieMissingText: { fontSize: 11, color: colors.muted },
  profileCol: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.tintTeal,
  },
  avatarInitial: {
    fontSize: 28,
    fontFamily: "Quicksand_700Bold",
    color: colors.teal,
  },
  firstName: {
    fontSize: 16,
    fontFamily: "Quicksand_700Bold",
    color: colors.foreground,
  },
  ageText: {
    fontSize: 12,
    color: colors.muted,
    fontFamily: "Quicksand_400Regular",
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  rejectBtn: {
    flex: 1,
    borderRadius: radius.full,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#DC2626",
    backgroundColor: colors.background,
  },
  rejectBtnText: {
    fontSize: 14,
    color: "#DC2626",
    fontFamily: "Quicksand_600SemiBold",
    fontWeight: "600",
  },
  approveBtn: {
    borderRadius: radius.full,
    paddingVertical: 12,
    alignItems: "center",
  },
  approveBtnText: {
    fontSize: 14,
    color: colors.white,
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
  },
});
