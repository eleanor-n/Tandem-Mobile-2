// SettingsScreen — sectioned settings hub opened from the gear icon
// on ProfileScreen. Houses every secondary action that used to clutter
// the profile (privacy controls, share, delete, etc.) so the profile
// itself can stay focused on identity + voice + activity.

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Switch,
  Linking,
  Alert,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { colors, radius, shadows } from "../theme";
import { EduVerificationModal } from "../components/safety/EduVerificationModal";

interface SettingsScreenProps {
  onBack: () => void;
  onMembershipPress?: () => void;
  onSafetyPress?: () => void;
  onAdminReviewPress?: () => void;
  onSelfieVerifyPress?: () => void;
  onEditProfilePress?: () => void;
  onNotificationPrefsPress?: () => void;
  onTermsPress?: () => void;
  onPrivacyPress?: () => void;
}

const VISIBILITY_FIELDS = [
  { key: "gender", label: "Gender" },
  { key: "relationship_status", label: "Relationship Status" },
  { key: "occupation", label: "Job / Occupation" },
  { key: "mbti", label: "Personality Type" },
  { key: "humor_type", label: "Humor Type" },
  { key: "purpose", label: "Looking For" },
];

const tierLabelForCol = (tier: string) =>
  tier === "go"
    ? "Tandem Go"
    : tier === "trail"
      ? "Tandem Trail"
      : "Free";

export const SettingsScreen = ({
  onBack,
  onMembershipPress,
  onSafetyPress,
  onAdminReviewPress,
  onSelfieVerifyPress,
  onEditProfilePress,
  onNotificationPrefsPress,
  onTermsPress,
  onPrivacyPress,
}: SettingsScreenProps) => {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();

  const [tier, setTier] = useState("free");
  const [firstName, setFirstName] = useState<string | null>(null);
  const [pronouns, setPronouns] = useState<string | null>(null);
  const [yearOfSchool, setYearOfSchool] = useState<string | null>(null);
  const [selfieVerified, setSelfieVerified] = useState(false);
  const [selfieStatus, setSelfieStatus] = useState<
    "approved" | "pending_review" | "rejected" | null
  >(null);
  const [eduVerified, setEduVerified] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [openingPortal, setOpeningPortal] = useState(false);

  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [showEduVerify, setShowEduVerify] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteFinal, setShowDeleteFinal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select(
        "first_name, pronouns, year_of_school, membership_tier, selfie_verified, selfie_verification_status, edu_verified, is_admin, profile_visibility",
      )
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (!data) return;
        setFirstName(data.first_name ?? null);
        setPronouns(data.pronouns ?? null);
        setYearOfSchool(data.year_of_school ?? null);
        setTier(data.membership_tier ?? "free");
        setSelfieVerified(!!data.selfie_verified);
        setSelfieStatus(data.selfie_verification_status ?? null);
        setEduVerified(!!data.edu_verified);
        setIsAdmin(!!data.is_admin);
        if (data.profile_visibility) {
          setVisibility(data.profile_visibility);
        } else {
          setVisibility({
            gender: true,
            relationship_status: true,
            occupation: true,
            mbti: true,
            humor_type: true,
            purpose: true,
          });
        }
      });
  }, [user]);

  const handleManageSubscription = async () => {
    if (!user || openingPortal) return;
    setOpeningPortal(true);
    try {
      const { data } = await supabase.functions.invoke("create-portal-session", {
        body: { user_id: user.id },
      });
      if ((data as any)?.url) {
        await Linking.openURL((data as any).url);
      } else if (onMembershipPress) {
        onMembershipPress();
      }
    } catch (err) {
      console.warn("[settings] portal failed:", err);
      if (onMembershipPress) onMembershipPress();
    } finally {
      setOpeningPortal(false);
    }
  };

  const handleVisibilityToggle = async (key: string) => {
    const next = { ...visibility, [key]: !(visibility[key] ?? true) };
    setVisibility(next);
    if (user) {
      await supabase
        .from("profiles")
        .update({ profile_visibility: next } as any)
        .eq("user_id", user.id);
    }
  };

  const handleShareProfile = async () => {
    const name = firstName ?? "someone";
    try {
      await Share.share({
        title: `${name} is on Tandem`,
        message: `${name} is on Tandem, the companionship app. never go alone: https://thetandemweb.com`,
      });
    } catch (err: any) {
      console.warn("[settings] share failed:", err?.message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!user || deleting) return;
    setDeleting(true);
    try {
      await supabase.functions.invoke("delete-account", { body: { user_id: user.id } });
      await signOut();
    } catch {
      Alert.alert(
        "Couldn't delete account.",
        "Contact tandemapp.hq@gmail.com and we'll handle it manually.",
      );
    } finally {
      setDeleting(false);
      setShowDeleteFinal(false);
      setShowDeleteConfirm(false);
    }
  };

  const selfieRowValue =
    selfieVerified || selfieStatus === "approved"
      ? "verified"
      : selfieStatus === "pending_review"
        ? "pending"
        : "retry";

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.teal} />
          <Text style={s.backText}>profile</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>settings</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.content, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Section title="account">
          <Row label="edit profile" onPress={onEditProfilePress} />
          <Row label="manage what others see" onPress={() => setShowVisibilityModal(true)} />
          <Row
            label="pronouns + year of school"
            value={[pronouns, yearOfSchool].filter(Boolean).join(" · ") || "add"}
            onPress={onEditProfilePress}
            last
          />
        </Section>

        <Section title="safety">
          <Row
            label="verify selfie"
            value={selfieRowValue}
            valueTone={
              selfieRowValue === "verified"
                ? "ok"
                : selfieRowValue === "pending"
                  ? "warn"
                  : "neutral"
            }
            onPress={() => {
              if (selfieVerified || selfieStatus === "approved") return;
              onSelfieVerifyPress?.();
            }}
          />
          <Row
            label="verify .edu"
            value={eduVerified ? "verified" : "verify"}
            valueTone={eduVerified ? "ok" : "neutral"}
            onPress={() => {
              if (eduVerified) return;
              setShowEduVerify(true);
            }}
          />
          <Row label="safety settings" onPress={() => onSafetyPress?.()} last />
        </Section>

        <Section title="subscription">
          <Row label="current tier" value={tierLabelForCol(tier)} static last={tier === "free"} />
          {tier !== "free" ? (
            <Row label="manage subscription" onPress={handleManageSubscription} last />
          ) : (
            <Row label="upgrade plan" onPress={() => onMembershipPress?.()} last />
          )}
        </Section>

        <Section title="notifications">
          <Row
            label="push preferences"
            onPress={() => onNotificationPrefsPress?.()}
            last
          />
        </Section>

        <Section title="sharing">
          <Row label="share your profile" onPress={handleShareProfile} last />
        </Section>

        <Section title="legal">
          <Row label="terms of service" onPress={() => onTermsPress?.()} />
          <Row label="privacy policy" onPress={() => onPrivacyPress?.()} last />
        </Section>

        {isAdmin ? (
          <Section title="admin">
            <Row
              label="review pending verifications"
              onPress={() => onAdminReviewPress?.()}
              last
            />
          </Section>
        ) : null}

        <Section title="danger zone">
          <DangerRow label="sign out" onPress={signOut} />
          <DangerRow label="delete account" onPress={() => setShowDeleteConfirm(true)} last />
        </Section>

        <Text style={s.version}>Tandem v1.0.0</Text>
      </ScrollView>

      {/* Manage what others see modal */}
      <Modal
        visible={showVisibilityModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowVisibilityModal(false)}
      >
        <View style={s.container}>
          <View style={s.modalHandle} />
          <View style={s.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowVisibilityModal(false)}
              style={s.backBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={22} color={colors.teal} />
              <Text style={s.backText}>settings</Text>
            </TouchableOpacity>
            <Text style={s.headerTitle}>visibility</Text>
            <View style={{ width: 70 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 8 }}>
            <Text style={s.modalDesc}>
              toggle off anything you don't want shown on your public profile.
            </Text>
            <View style={s.card}>
              {VISIBILITY_FIELDS.map((field, i) => (
                <View key={field.key}>
                  {i > 0 ? <View style={s.divider} /> : null}
                  <View style={s.row}>
                    <Text style={s.rowLabel}>{field.label}</Text>
                    <Switch
                      value={visibility[field.key] ?? true}
                      onValueChange={() => handleVisibilityToggle(field.key)}
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

      {/* Delete account — step 1 */}
      <Modal
        visible={showDeleteConfirm}
        animationType="fade"
        transparent
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.confirmCard}>
            <Text style={s.confirmTitle}>Delete your Tandem account?</Text>
            <Text style={s.confirmBody}>
              This permanently deletes your profile, posts, messages, and scrapbook. There's no undo.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowDeleteConfirm(false);
                setShowDeleteFinal(true);
              }}
              style={s.deleteBtnPrimary}
              activeOpacity={0.85}
            >
              <Text style={s.deleteBtnPrimaryText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowDeleteConfirm(false)}
              style={s.confirmCancel}
              activeOpacity={0.7}
            >
              <Text style={s.confirmCancelText}>cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete account — step 2 (final) */}
      <Modal
        visible={showDeleteFinal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowDeleteFinal(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.confirmCard}>
            <Text style={s.confirmTitle}>Last chance.</Text>
            <Text style={s.confirmBody}>
              Tap "Delete forever" to permanently remove your account. We can't recover it after this.
            </Text>
            <TouchableOpacity
              onPress={handleDeleteConfirm}
              disabled={deleting}
              style={[s.deleteBtnPrimary, deleting && { opacity: 0.6 }]}
              activeOpacity={0.85}
            >
              <Text style={s.deleteBtnPrimaryText}>
                {deleting ? "Deleting..." : "Delete forever"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowDeleteFinal(false)}
              style={s.confirmCancel}
              activeOpacity={0.7}
            >
              <Text style={s.confirmCancelText}>cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <EduVerificationModal
        visible={showEduVerify}
        onClose={() => setShowEduVerify(false)}
        onVerified={() => setShowEduVerify(false)}
        onSkip={() => setShowEduVerify(false)}
      />
    </View>
  );
};

// ── Row components ──────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.sectionWrap}>
      <Text style={s.sectionLabel}>{title}</Text>
      <View style={s.card}>{children}</View>
    </View>
  );
}

function Row({
  label,
  value,
  valueTone,
  onPress,
  last,
  static: isStatic,
}: {
  label: string;
  value?: string;
  valueTone?: "ok" | "warn" | "neutral";
  onPress?: () => void;
  last?: boolean;
  static?: boolean;
}) {
  const toneColor =
    valueTone === "ok"
      ? colors.teal
      : valueTone === "warn"
        ? "#F59E0B"
        : colors.muted;

  const content = (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <View style={s.rowRight}>
        {value ? (
          <Text style={[s.rowValue, { color: toneColor }]}>{value}</Text>
        ) : null}
        {isStatic ? null : (
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        )}
      </View>
    </View>
  );

  return (
    <>
      {isStatic || !onPress ? (
        content
      ) : (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
          {content}
        </TouchableOpacity>
      )}
      {last ? null : <View style={s.divider} />}
    </>
  );
}

function DangerRow({
  label,
  onPress,
  last,
}: {
  label: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <>
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <View style={s.row}>
          <Text style={s.dangerLabel}>{label}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.destructive} />
        </View>
      </TouchableOpacity>
      {last ? null : <View style={s.divider} />}
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    width: 70,
  },
  backText: {
    fontSize: 14,
    fontFamily: "Quicksand_600SemiBold",
    fontWeight: "600",
    color: colors.teal,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 14, gap: 4 },

  sectionWrap: { marginTop: 18 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
    color: colors.muted,
    letterSpacing: 1.2,
    marginBottom: 6,
    marginLeft: 4,
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowLabel: {
    fontSize: 15,
    color: colors.foreground,
    fontFamily: "Quicksand_500Medium",
    fontWeight: "500",
  },
  rowValue: {
    fontSize: 13,
    fontFamily: "Quicksand_500Medium",
    fontWeight: "500",
  },
  dangerLabel: {
    fontSize: 15,
    color: colors.destructive,
    fontFamily: "Quicksand_600SemiBold",
    fontWeight: "600",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 16,
  },

  version: {
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
    marginTop: 24,
  },

  // Modals
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalDesc: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
    marginBottom: 10,
    fontFamily: "Quicksand_500Medium",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  confirmCard: {
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    padding: 24,
    ...shadows.float,
  },
  confirmTitle: {
    fontSize: 18,
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
    color: colors.foreground,
    textAlign: "center",
    marginBottom: 8,
  },
  confirmBody: {
    fontSize: 14,
    color: colors.secondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 18,
    fontFamily: "Quicksand_500Medium",
  },
  deleteBtnPrimary: {
    backgroundColor: colors.destructive,
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: "center",
  },
  deleteBtnPrimaryText: {
    fontSize: 15,
    color: colors.white,
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
  },
  confirmCancel: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  confirmCancelText: {
    fontSize: 14,
    color: colors.muted,
    fontFamily: "Quicksand_500Medium",
  },
});
