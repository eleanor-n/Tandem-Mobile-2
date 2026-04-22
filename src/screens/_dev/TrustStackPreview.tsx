// DEV ONLY — not included in production builds.
// Renders TrustStack in every variant / edge case using mock data.
// Access via the "dev" button visible only when __DEV__ is true.

import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { TrustStack, type TrustState } from "../../components/safety/TrustStack";
import { colors, radius } from "../../theme";

// ── Mock data helpers ────────────────────────────────────────────────────────

function isoMonthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString();
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function mockProfile(overrides: {
  firstName?: string;
  pronouns?: string | null;
  selfieVerified?: boolean;
  phoneVerified?: boolean;
  eduVerified?: boolean;
  createdAt?: string | null;
}) {
  return {
    firstName: overrides.firstName ?? "maya",
    pronouns: overrides.pronouns ?? "she/her",
    selfieVerified: overrides.selfieVerified ?? false,
    phoneVerified: overrides.phoneVerified ?? false,
    eduVerified: overrides.eduVerified ?? false,
    createdAt: overrides.createdAt ?? isoMonthsAgo(4),
  };
}

// ── Profile variant cases ────────────────────────────────────────────────────

const PROFILE_CASES: { label: string; trust: TrustState }[] = [
  {
    label: "a. all three verified + 5 shared tandems",
    trust: {
      profile: mockProfile({ selfieVerified: true, phoneVerified: true, eduVerified: true }),
      tandemsCount: 12,
      sharedCount: 5,
    },
  },
  {
    label: "b. only selfie verified + 0 shared tandems",
    trust: {
      profile: mockProfile({ selfieVerified: true, phoneVerified: false, eduVerified: false }),
      tandemsCount: 3,
      sharedCount: 0,
    },
  },
  {
    label: "c. none verified + 2 shared tandems",
    trust: {
      profile: mockProfile({ selfieVerified: false, phoneVerified: false, eduVerified: false }),
      tandemsCount: 7,
      sharedCount: 2,
    },
  },
  {
    label: "d. all verified, brand new (<1 month), 0 shared",
    trust: {
      profile: mockProfile({
        selfieVerified: true,
        phoneVerified: true,
        eduVerified: true,
        createdAt: isoDaysAgo(10),
      }),
      tandemsCount: 0,
      sharedCount: 0,
    },
  },
];

// ── Post-card variant cases ──────────────────────────────────────────────────

const CARD_CASES: { label: string; trust: TrustState }[] = [
  {
    label: "a. verified + 3 shared + 4 months",
    trust: {
      profile: mockProfile({
        selfieVerified: true,
        phoneVerified: true,
        eduVerified: false,
        createdAt: isoMonthsAgo(4),
      }),
      tandemsCount: 9,
      sharedCount: 3,
    },
  },
  {
    label: "b. verified + 0 shared + 6 months",
    trust: {
      profile: mockProfile({
        selfieVerified: true,
        phoneVerified: false,
        eduVerified: false,
        createdAt: isoMonthsAgo(6),
      }),
      tandemsCount: 5,
      sharedCount: 0,
    },
  },
  {
    label: "c. new user (<1 month) + 0 shared, not verified",
    trust: {
      profile: mockProfile({
        selfieVerified: false,
        phoneVerified: false,
        eduVerified: false,
        createdAt: isoDaysAgo(8),
      }),
      tandemsCount: 0,
      sharedCount: 0,
    },
  },
];

// ── Post-detail variant cases ────────────────────────────────────────────────

const DETAIL_CASES: { label: string; trust: TrustState }[] = [
  {
    label: "a. main case — 4 months, 7 tandems, 2 shared (she/her)",
    trust: {
      profile: mockProfile({
        pronouns: "she/her",
        selfieVerified: true,
        createdAt: isoMonthsAgo(4),
      }),
      tandemsCount: 7,
      sharedCount: 2,
    },
  },
  {
    label: "b. 0 shared tandems — 3 months, 5 tandems (she/her)",
    trust: {
      profile: mockProfile({
        pronouns: "she/her",
        selfieVerified: true,
        createdAt: isoMonthsAgo(3),
      }),
      tandemsCount: 5,
      sharedCount: 0,
    },
  },
  {
    label: "c. new user (<1 month) — 2 weeks, 3 tandems, 1 shared",
    trust: {
      profile: mockProfile({
        firstName: "alex",
        pronouns: "they/them",
        selfieVerified: true,
        createdAt: isoDaysAgo(14),
      }),
      tandemsCount: 3,
      sharedCount: 1,
    },
  },
  {
    label: "d. 0 tandems — 5 months (uses 'they're verified' fallback)",
    trust: {
      profile: mockProfile({
        firstName: "jordan",
        pronouns: null,
        selfieVerified: true,
        phoneVerified: true,
        createdAt: isoMonthsAgo(5),
      }),
      tandemsCount: 0,
      sharedCount: 0,
    },
  },
  {
    label: "e. brand new + 0 tandems (<1 month, 0 tandems)",
    trust: {
      profile: mockProfile({
        firstName: "sam",
        pronouns: "he/him",
        selfieVerified: true,
        createdAt: isoDaysAgo(3),
      }),
      tandemsCount: 0,
      sharedCount: 0,
    },
  },
];

// ── Section component ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={p.section}>
      <Text style={p.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function CaseRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={p.caseRow}>
      <Text style={p.caseLabel}>{label}</Text>
      <View style={p.caseContent}>{children}</View>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

// Stub IDs — TrustStack with mockTrust skips any network fetch.
const STUB_USER_ID = "preview-user";
const STUB_VIEWER_ID = "preview-viewer";

export function TrustStackPreview({ onBack }: { onBack: () => void }) {
  const [showExplainerDemo, setShowExplainerDemo] = useState(false);

  return (
    <SafeAreaView style={p.root}>
      {/* Header */}
      <View style={p.header}>
        <TouchableOpacity onPress={onBack} style={p.backBtn}>
          <Text style={p.backText}>← back</Text>
        </TouchableOpacity>
        <Text style={p.headerTitle}>TrustStack preview</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={p.scroll}
        contentContainerStyle={p.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile variant ── */}
        <Section title="profile variant">
          {PROFILE_CASES.map((c) => (
            <CaseRow key={c.label} label={c.label}>
              <TrustStack
                userId={STUB_USER_ID}
                viewerId={STUB_VIEWER_ID}
                variant="profile"
                mockTrust={c.trust}
              />
            </CaseRow>
          ))}
        </Section>

        {/* ── Post-card variant ── */}
        <Section title="post-card variant">
          {CARD_CASES.map((c) => (
            <CaseRow key={c.label} label={c.label}>
              <View style={p.cardSimulator}>
                <TrustStack
                  userId={STUB_USER_ID}
                  viewerId={STUB_VIEWER_ID}
                  variant="post-card"
                  mockTrust={c.trust}
                />
              </View>
            </CaseRow>
          ))}
        </Section>

        {/* ── Post-detail variant ── */}
        <Section title="post-detail variant">
          {DETAIL_CASES.map((c) => (
            <CaseRow key={c.label} label={c.label}>
              <TrustStack
                userId={STUB_USER_ID}
                viewerId={STUB_VIEWER_ID}
                variant="post-detail"
                mockTrust={c.trust}
              />
            </CaseRow>
          ))}
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const p = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F0EDE6",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backBtn: {
    width: 60,
  },
  backText: {
    fontSize: 14,
    color: colors.teal,
    fontFamily: "Quicksand_600SemiBold",
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.foreground,
    fontFamily: "Quicksand_700Bold",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    fontFamily: "Quicksand_700Bold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  caseRow: {
    marginBottom: 16,
  },
  caseLabel: {
    fontSize: 11,
    color: colors.muted,
    fontFamily: "Quicksand_400Regular",
    marginBottom: 6,
    fontStyle: "italic",
  },
  caseContent: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardSimulator: {
    // Mimics being inside an activity card
  },
});
