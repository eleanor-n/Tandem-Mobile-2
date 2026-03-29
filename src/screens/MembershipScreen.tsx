import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, shadows, gradients } from "../theme";

type Period = "week" | "month" | "3months" | "year";

const PERIODS: { key: Period; label: string; badge?: string }[] = [
  { key: "week",     label: "1 week" },
  { key: "month",    label: "1 month" },
  { key: "3months",  label: "3 months" },
  { key: "year",     label: "Annually", badge: "BEST" },
];

const BILLING_LABEL: Record<Period, string> = {
  week:      "weekly",
  month:     "monthly",
  "3months": "every 3 months",
  year:      "annually",
};

const PRICING: Record<"go" | "trail", Record<Period, { price: string; perWeek: string }>> = {
  go: {
    week:      { price: "$5.99",   perWeek: "$5.99/wk" },
    month:     { price: "$15.99",  perWeek: "$3.99/wk" },
    "3months": { price: "$35.99",  perWeek: "$2.99/wk" },
    year:      { price: "$119.99", perWeek: "$2.31/wk" },
  },
  trail: {
    week:      { price: "$7.99",   perWeek: "$7.99/wk" },
    month:     { price: "$23.99",  perWeek: "$5.99/wk" },
    "3months": { price: "$53.99",  perWeek: "$4.49/wk" },
    year:      { price: "$179.99", perWeek: "$3.46/wk" },
  },
};

const GO_FEATURES = [
  "Unlimited I'm In's",
  "See who viewed your profile",
  "Advanced discovery filters",
  "Scrapbook memories",
  "Priority profile matching",
  "Priority support",
];

const TRAIL_FEATURES = [
  "Everything in Go",
  "Trail-exclusive adventures",
  "Early access to events",
  "Founding member badge",
];

const COMPARISON: { label: string; free: boolean; go: boolean; trail: boolean }[] = [
  { label: "Browse activities",     free: true,  go: true,  trail: true  },
  { label: "I'm In (5/month)",      free: true,  go: false, trail: false },
  { label: "Unlimited I'm In's",    free: false, go: true,  trail: true  },
  { label: "See who viewed you",    free: false, go: true,  trail: true  },
  { label: "Advanced filters",      free: false, go: true,  trail: true  },
  { label: "Scrapbook",             free: false, go: true,  trail: true  },
  { label: "Priority matching",     free: false, go: true,  trail: true  },
  { label: "Priority support",      free: false, go: true,  trail: false },
  { label: "Trail adventures",      free: false, go: false, trail: true  },
  { label: "Founding member badge", free: false, go: false, trail: true  },
];

interface MembershipScreenProps {
  onBack: () => void;
  currentTier?: string;
}

export const MembershipScreen = ({ onBack, currentTier = "free" }: MembershipScreenProps) => {
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>("month");
  const [showComingSoon, setShowComingSoon] = useState(false);

  const isCurrentPlan = (tier: string) =>
    tier === currentTier || (tier === "free" && currentTier === "free");

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.teal} />
          <Text style={s.backText}>back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>membership</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: 60 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <Text style={s.heroTitle}>find your people.</Text>
          <Text style={s.heroSub}>unlock the full tandem experience.</Text>
        </LinearGradient>

        {/* Billing period selector */}
        <View style={s.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[s.periodBtn, period === p.key && s.periodBtnActive]}
              onPress={() => setPeriod(p.key)}
              activeOpacity={0.8}
            >
              {p.badge && (
                <View style={s.bestBadge}>
                  <Text style={s.bestBadgeText}>{p.badge}</Text>
                </View>
              )}
              <Text style={[s.periodText, period === p.key && s.periodTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Free tier ───────────────────────────────────────── */}
        <View style={s.freeCard}>
          <View style={s.freeTierTop}>
            <View>
              <Text style={s.freeTierName}>tandem</Text>
              <View style={s.priceRow}>
                <Text style={s.freePrice}>$0</Text>
                <Text style={s.freePriceSub}> / forever</Text>
              </View>
            </View>
            <View style={s.freeBadge}>
              <Text style={s.freeBadgeText}>free</Text>
            </View>
          </View>
          <View style={s.features}>
            {["browse activities", "post activities", "5 i'm in's per month"].map(f => (
              <View key={f} style={s.featureRow}>
                <Ionicons name="checkmark-circle" size={15} color={colors.muted} />
                <Text style={s.featureText}>{f}</Text>
              </View>
            ))}
          </View>
          <View style={s.currentPlanPill}>
            <Text style={s.currentPlanText}>{isCurrentPlan("free") ? "current plan" : "downgrade"}</Text>
          </View>
        </View>

        {/* ── Tandem Go ───────────────────────────────────────── */}
        <View style={s.goCard}>
          {/* Most popular badge */}
          <View style={s.popularBadgeWrap}>
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.popularBadge}>
              <Text style={s.popularBadgeText}>most popular</Text>
            </LinearGradient>
          </View>

          <View style={s.goCardTop}>
            <Text style={s.goTierName}>tandem go</Text>
            <View style={s.priceRow}>
              <Text style={s.goPrice}>{PRICING.go[period].perWeek}</Text>
            </View>
            <Text style={s.goPriceSub}>{PRICING.go[period].price} billed {BILLING_LABEL[period]}</Text>
          </View>

          <View style={s.features}>
            {GO_FEATURES.map(f => (
              <View key={f} style={s.featureRow}>
                <Ionicons name="checkmark-circle" size={15} color={colors.teal} />
                <Text style={s.featureText}>{f}</Text>
              </View>
            ))}
          </View>

          {isCurrentPlan("go") ? (
            <View style={s.currentPlanPill}>
              <Text style={s.currentPlanText}>current plan</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={s.goCtaWrap}
              onPress={() => setShowComingSoon(true)}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.ctaInner}
              >
                <Text style={s.ctaText}>upgrade to go</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Tandem Trail ────────────────────────────────────── */}
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.trailCard}
        >
          <View style={s.trailCardTop}>
            <Text style={s.trailTierName}>tandem trail</Text>
            <View style={s.priceRow}>
              <Text style={s.trailPrice}>{PRICING.trail[period].perWeek}</Text>
            </View>
            <Text style={s.trailPriceSub}>{PRICING.trail[period].price} billed {BILLING_LABEL[period]}</Text>
          </View>

          <View style={s.features}>
            {TRAIL_FEATURES.map(f => (
              <View key={f} style={s.featureRow}>
                <Ionicons name="checkmark-circle" size={15} color="rgba(255,255,255,0.9)" />
                <Text style={s.featureTextWhite}>{f}</Text>
              </View>
            ))}
          </View>

          {isCurrentPlan("trail") ? (
            <View style={s.trailCurrentPill}>
              <Text style={s.trailCurrentText}>current plan</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={s.trailCtaWrap}
              onPress={() => setShowComingSoon(true)}
              activeOpacity={0.88}
            >
              <View style={s.trailCta}>
                <Text style={s.trailCtaText}>blaze the trail</Text>
              </View>
            </TouchableOpacity>
          )}
        </LinearGradient>

        {/* Comparison table */}
        <Text style={s.compTitle}>COMPARE PLANS</Text>
        <View style={s.compTable}>
          <View style={s.compHeaderRow}>
            <View style={s.compFeatureCol} />
            {["free", "go", "trail"].map(t => (
              <View key={t} style={s.compTierCol}>
                <Text style={[s.compTierLabel, currentTier === t && s.compTierLabelActive]}>{t}</Text>
              </View>
            ))}
          </View>
          {COMPARISON.map((f, i) => (
            <View key={f.label} style={[s.compRow, i % 2 === 1 && s.compRowAlt]}>
              <View style={s.compFeatureCol}>
                <Text style={s.compFeatureText}>{f.label}</Text>
              </View>
              {[f.free, f.go, f.trail].map((has, j) => (
                <View key={j} style={s.compTierCol}>
                  <Ionicons
                    name={has ? "checkmark-circle" : "remove-circle-outline"}
                    size={16}
                    color={has ? colors.teal : colors.border}
                  />
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Coming Soon Modal */}
      <Modal
        visible={showComingSoon}
        transparent
        animationType="fade"
        onRequestClose={() => setShowComingSoon(false)}
      >
        <View style={cs.overlay}>
          <View style={cs.sheet}>
            <View style={cs.iconWrap}>
              <Ionicons name="rocket-outline" size={36} color={colors.teal} />
            </View>
            <Text style={cs.title}>payments are almost here.</Text>
            <Text style={cs.desc}>
              we're wiring up stripe right now. check back soon — your upgrade will be worth the wait.
            </Text>
            <TouchableOpacity style={cs.btn} onPress={() => setShowComingSoon(false)} activeOpacity={0.88}>
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cs.btnInner}>
                <Text style={cs.btnText}>sounds good</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2, width: 60 },
  backText: { fontSize: 14, fontWeight: "600", color: colors.teal },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.foreground, letterSpacing: -0.4 },

  content: { padding: 16, gap: 14 },

  // Hero
  hero: { borderRadius: radius.xl, padding: 24, gap: 6 },
  heroTitle: { fontSize: 22, fontWeight: "800", color: colors.white, letterSpacing: -0.5 },
  heroSub: { fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 20 },

  // Period selector
  periodRow: { flexDirection: "row", gap: 8 },
  periodBtn: {
    flex: 1, paddingVertical: 10, borderRadius: radius.md,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border,
    alignItems: "center", position: "relative",
  },
  periodBtnActive: { borderColor: colors.teal, backgroundColor: colors.tintTeal },
  periodText: { fontSize: 12, fontWeight: "600", color: colors.muted },
  periodTextActive: { color: colors.teal, fontWeight: "700" },
  bestBadge: {
    position: "absolute", top: -8, right: -4,
    backgroundColor: colors.teal, borderRadius: radius.full,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  bestBadgeText: { fontSize: 8, fontWeight: "700", color: colors.white, letterSpacing: 0.5 },

  // Shared
  priceRow: { flexDirection: "row", alignItems: "baseline", marginTop: 4 },
  features: { paddingHorizontal: 16, paddingBottom: 4, gap: 9 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText: { fontSize: 14, color: colors.foreground, flex: 1 },
  featureTextWhite: { fontSize: 14, color: "rgba(255,255,255,0.92)", flex: 1 },
  currentPlanPill: {
    margin: 16, marginTop: 8, height: 44, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  currentPlanText: { fontSize: 14, fontWeight: "600", color: colors.muted },
  ctaInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  ctaText: { fontSize: 15, fontWeight: "700", color: colors.white },

  // Free card
  freeCard: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    borderWidth: 1.5, borderColor: "#E5E7EB", ...shadows.card,
    overflow: "hidden",
  },
  freeTierTop: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    padding: 16, paddingBottom: 12,
  },
  freeTierName: { fontSize: 16, fontWeight: "700", color: colors.foreground },
  freePrice: { fontSize: 26, fontWeight: "800", color: colors.foreground, letterSpacing: -1 },
  freePriceSub: { fontSize: 13, color: colors.muted, alignSelf: "flex-end", paddingBottom: 3 },
  freeBadge: {
    backgroundColor: colors.surface, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  freeBadgeText: { fontSize: 11, fontWeight: "600", color: colors.muted },

  // Go card
  goCard: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    borderWidth: 2, borderColor: colors.teal,
    shadowColor: colors.teal, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
    overflow: "hidden",
  },
  popularBadgeWrap: { alignItems: "center", marginTop: 12 },
  popularBadge: { borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 5 },
  popularBadgeText: { fontSize: 11, fontWeight: "700", color: colors.white, letterSpacing: 0.3 },
  goCardTop: { padding: 16, paddingTop: 10, paddingBottom: 12 },
  goTierName: { fontSize: 16, fontWeight: "700", color: colors.foreground },
  goPrice: { fontSize: 26, fontWeight: "800", color: colors.teal, letterSpacing: -1 },
  goPriceSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  goCtaWrap: { margin: 16, marginTop: 8, height: 48, borderRadius: radius.full, overflow: "hidden", ...shadows.brand },

  // Trail card
  trailCard: { borderRadius: radius.xl, overflow: "hidden" },
  trailCardTop: { padding: 16, paddingBottom: 12 },
  trailTierName: { fontSize: 16, fontWeight: "700", color: colors.white },
  trailPrice: { fontSize: 26, fontWeight: "800", color: colors.white, letterSpacing: -1 },
  trailPriceSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  trailCurrentPill: {
    margin: 16, marginTop: 8, height: 44, borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center",
  },
  trailCurrentText: { fontSize: 14, fontWeight: "600", color: colors.white },
  trailCtaWrap: { margin: 16, marginTop: 8 },
  trailCta: {
    height: 48, borderRadius: radius.full,
    backgroundColor: colors.white, alignItems: "center", justifyContent: "center",
  },
  trailCtaText: { fontSize: 15, fontWeight: "700", color: colors.teal },

  // Comparison
  compTitle: { fontSize: 10, fontWeight: "700", color: colors.muted, letterSpacing: 1.2, marginTop: 4 },
  compTable: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    overflow: "hidden", borderWidth: 1, borderColor: colors.border,
  },
  compHeaderRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  compRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 16 },
  compRowAlt: { backgroundColor: colors.surface },
  compFeatureCol: { flex: 2.5 },
  compFeatureText: { fontSize: 12, color: colors.foreground },
  compTierCol: { flex: 1, alignItems: "center" },
  compTierLabel: { fontSize: 12, fontWeight: "700", color: colors.muted },
  compTierLabelActive: { color: colors.teal },
});

const cs = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  sheet: { backgroundColor: colors.white, borderRadius: radius.xl, padding: 28, gap: 14, alignItems: "center", width: "100%", ...shadows.float },
  iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.tintTeal, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", color: colors.foreground, letterSpacing: -0.4, textAlign: "center" },
  desc: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
  btn: { width: "100%", height: 50, borderRadius: radius.full, overflow: "hidden", ...shadows.brand },
  btnInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 15, fontWeight: "700", color: colors.white },
});
