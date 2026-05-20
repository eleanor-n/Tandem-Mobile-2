import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Animated, Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { useFonts, Fraunces_500Medium_Italic, Fraunces_700Bold_Italic } from "@expo-google-fonts/fraunces";
import { colors, radius, shadows, gradients } from "../theme";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { getSunnyResponse } from "../lib/sunny";
import { billingCaption, calculatePerWeek } from "../lib/pricing";

// REQUIRED Supabase edge function secrets:
// - STRIPE_SECRET_KEY (sk_live_...)
// - STRIPE_WEBHOOK_SECRET (whsec_...)
// Set at: supabase.com/dashboard/project/ccntlaunczirvntnsjbm/functions

type Period = "weekly" | "monthly" | "sixMonth" | "annual";
type Tier = "go" | "trail";

const PERIODS: { key: Period; label: string }[] = [
  { key: "weekly",   label: "weekly" },
  { key: "monthly",  label: "monthly" },
  { key: "sixMonth", label: "6 months" },
  { key: "annual",   label: "annual" },
];

// PRICE_ID for the new sixMonth tier is set to the existing 3-month price
// IDs until the 6-month prices ship in Stripe. See the report at the end of
// this commit for the manual step.
const PRICES: Record<Tier, Record<Period, { id: string; totalCents: number }>> = {
  go: {
    weekly:   { id: "price_1T6Xe1QtlSTTnULkTpBp1mxM", totalCents: 599   },
    monthly:  { id: "price_1T6XqKQtlSTTnULkkkm1vB5D", totalCents: 1599  },
    sixMonth: { id: "price_1THMmpQtlSTTnULkYuEn9Lmc", totalCents: 7999  },
    annual:   { id: "price_1T6XqRQtlSTTnULk9QguocAx", totalCents: 11999 },
  },
  trail: {
    weekly:   { id: "price_1T6XiSQtlSTTnULkFUO91T1d", totalCents: 799   },
    monthly:  { id: "price_1T6XqSQtlSTTnULk8FOPYTiK", totalCents: 2399  },
    sixMonth: { id: "price_1THMmsQtlSTTnULkWc52qIoe", totalCents: 11999 },
    annual:   { id: "price_1T6XqUQtlSTTnULkkCs6dJyP", totalCents: 17999 },
  },
};

const PERIOD_TO_INTERVAL: Record<Period, "week" | "month" | "sixmonth" | "year"> = {
  weekly:   "week",
  monthly:  "month",
  sixMonth: "sixmonth",
  annual:   "year",
};

// Savings vs weekly rate
const SAVINGS: Record<Tier, Partial<Record<Period, string>>> = {
  go:    { sixMonth: "save 66%", annual: "save 61%" },
  trail: { sixMonth: "save 64%", annual: "save 57%" },
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
  { label: "I'm In (3/month)",      free: true,  go: false, trail: false },
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
  const { user, refreshOnboarding } = useAuth();
  const [period, setPeriod] = useState<Period>("monthly");
  const [loadingTier, setLoadingTier] = useState<Tier | null>(null);
  const [fontsLoaded] = useFonts({ Fraunces_500Medium_Italic, Fraunces_700Bold_Italic });
  const [sunnyBanner, setSunnyBanner] = useState<string | null>(null);
  const sunnyBannerOpacity = useRef(new Animated.Value(0)).current;
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);

  const isCurrentPlan = (tier: string) => tier === currentTier;

  const handleSubscribe = async (tier: Tier) => {
    if (!user) return;
    setLoadingTier(tier);
    try {
      const priceId = PRICES[tier][period].id;
      console.log("[checkout] invoking:", { tier, period, priceId });
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          priceId,
          userId: user.id,
          userEmail: user.email,
        },
      });
      console.log("[checkout] full response:", JSON.stringify({ data, error }, null, 2));
      console.log("[checkout] data keys:", data ? Object.keys(data) : "no data");

      // Surface a 200-with-error-body (function ran but Stripe rejected the call).
      const errorMessage = (data as any)?.error ?? error?.message;
      const url: string | undefined = (data as any)?.url;
      console.log("[checkout] extracted url:", url, "errorMessage:", errorMessage);

      if (!url) {
        console.error("[checkout] no url in response:", { data, error });
        Alert.alert(
          "Couldn't open checkout.",
          errorMessage
            ? `${errorMessage}. Please try again.`
            : "Please try again.",
          [{ text: "OK" }]
        );
        setLoadingTier(null);
        return;
      }

      // Use openBrowserAsync (SFSafariViewController on iOS), not
      // openAuthSessionAsync — the latter requires the redirect URL to be a
      // registered Universal Link and silently dismisses otherwise, which is
      // why the previous version did nothing visible.
      let browserOpened = false;
      try {
        await WebBrowser.openBrowserAsync(url);
        browserOpened = true;
      } catch (browserErr) {
        console.warn("[checkout] openBrowserAsync failed, falling back to Linking:", browserErr);
        try {
          await Linking.openURL(url);
          browserOpened = true;
        } catch (linkErr) {
          console.error("[checkout] Linking.openURL also failed:", linkErr);
        }
      }

      if (!browserOpened) {
        Alert.alert(
          "Couldn't open checkout.",
          "Please try again.",
          [{ text: "OK" }]
        );
        setLoadingTier(null);
        return;
      }

      // Refresh membership tier when the user returns from the in-app browser.
      await refreshOnboarding();

      const text = await getSunnyResponse({ context: "subscribeSuccess" });
      if (text) {
        setSunnyBanner(text);
        sunnyBannerOpacity.setValue(0);
        Animated.timing(sunnyBannerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        setTimeout(() => {
          Animated.timing(sunnyBannerOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => setSunnyBanner(null));
        }, 3500);
      }
    } catch (e) {
      console.warn("[checkout] exception:", e);
      Alert.alert("Couldn't open checkout.", "Please try again.", [{ text: "OK" }]);
    } finally {
      setLoadingTier(null);
    }
  };

  const handleRestorePurchases = async () => {
    if (!user) return;
    setRestoringPurchases(true);
    try {
      const { data } = await supabase.functions.invoke("restore-purchases", {
        body: { user_id: user.id },
      });
      if (data?.active_subscription) {
        await refreshOnboarding();
        Alert.alert("subscription restored", `your ${data.tier} plan is active.`);
      } else {
        Alert.alert("no active subscription", "we couldn't find an active subscription for this account.");
      }
    } catch {
      Alert.alert("something went wrong", "try again in a moment.");
    } finally {
      setRestoringPurchases(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!user) return;
    setOpeningPortal(true);
    try {
      const { data } = await supabase.functions.invoke("create-portal-session", {
        body: { user_id: user.id },
      });
      if (data?.url) {
        await WebBrowser.openBrowserAsync(data.url);
        await refreshOnboarding();
      } else {
        Alert.alert("couldn't open portal", "try again in a moment.");
      }
    } catch {
      Alert.alert("something went wrong", "try again in a moment.");
    } finally {
      setOpeningPortal(false);
    }
  };

  const savingsBadge = (tier: Tier) => {
    if (period === "sixMonth" || period === "annual") {
      return SAVINGS[tier][period];
    }
    return null;
  };

  return (
    <View style={s.container}>
      {sunnyBanner ? (
        <Animated.View style={[s.sunnyBanner, { opacity: sunnyBannerOpacity, top: insets.top + 4 }]} pointerEvents="none">
          <Text style={s.sunnyBannerText} numberOfLines={2}>{sunnyBanner}</Text>
        </Animated.View>
      ) : null}

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
          <Text style={s.heroTitle}>Never go alone.</Text>
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
          <View style={s.popularBadgeWrap}>
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.popularBadge}>
              <Text style={s.popularBadgeText}>most popular</Text>
            </LinearGradient>
          </View>

          <View style={s.goCardTop}>
            <View style={s.priceHeaderRow}>
              <Text style={s.goTierName}>tandem go</Text>
              {savingsBadge("go") && (
                <View style={s.savingsBadge}>
                  <Text style={s.savingsBadgeText}>{savingsBadge("go")}</Text>
                </View>
              )}
            </View>
            <Text style={s.goPrice}>{calculatePerWeek(PRICES.go[period].totalCents, PERIOD_TO_INTERVAL[period])}/week</Text>
            <Text style={s.billingNote}>{billingCaption(PRICES.go[period].totalCents, PERIOD_TO_INTERVAL[period])}</Text>
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
            <View style={s.ctaWrap}>
              <TouchableOpacity
                style={s.goCtaWrap}
                onPress={() => handleSubscribe("go")}
                activeOpacity={0.88}
                disabled={loadingTier !== null}
              >
                <LinearGradient
                  colors={gradients.brand}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.ctaInner}
                >
                  {loadingTier === "go" ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={s.ctaText}>Get Tandem Go</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              <Text style={s.renewFootnote}>cancel anytime.</Text>
            </View>
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
            <View style={s.priceHeaderRow}>
              <Text style={s.trailTierName}>tandem trail</Text>
              {savingsBadge("trail") && (
                <View style={s.savingsBadgeWhite}>
                  <Text style={s.savingsBadgeWhiteText}>{savingsBadge("trail")}</Text>
                </View>
              )}
            </View>
            <Text style={s.trailPrice}>{calculatePerWeek(PRICES.trail[period].totalCents, PERIOD_TO_INTERVAL[period])}/week</Text>
            <Text style={s.trailBillingNote}>{billingCaption(PRICES.trail[period].totalCents, PERIOD_TO_INTERVAL[period])}</Text>
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
            <View style={s.ctaWrap}>
              <TouchableOpacity
                style={s.trailCtaWrap}
                onPress={() => handleSubscribe("trail")}
                activeOpacity={0.88}
                disabled={loadingTier !== null}
              >
                <View style={s.trailCta}>
                  {loadingTier === "trail" ? (
                    <ActivityIndicator color={colors.teal} />
                  ) : (
                    <Text style={s.trailCtaText}>Get Tandem Trail</Text>
                  )}
                </View>
              </TouchableOpacity>
              {fontsLoaded && (
                <Text style={[s.renewNote, s.renewNoteWhite]}>renews automatically · cancel anytime</Text>
              )}
            </View>
          )}
        </LinearGradient>

        {/* Manage / restore */}
        {currentTier !== "free" ? (
          <TouchableOpacity
            style={s.manageSub}
            onPress={handleManageSubscription}
            activeOpacity={0.7}
            disabled={openingPortal}
          >
            {openingPortal
              ? <ActivityIndicator color={colors.teal} size="small" />
              : <Text style={s.manageSubText}>manage subscription →</Text>}
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={s.restoreBtn}
          onPress={handleRestorePurchases}
          activeOpacity={0.7}
          disabled={restoringPurchases}
        >
          {restoringPurchases
            ? <ActivityIndicator color={colors.muted} size="small" />
            : <Text style={s.restoreBtnText}>restore purchases</Text>}
        </TouchableOpacity>

        <Text style={s.billingFootnote}>
          cancel anytime. billed through your app store account.
        </Text>

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
  backText: { fontSize: 14, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.teal },
  headerTitle: { fontSize: 18, fontWeight: "800", fontFamily: "Quicksand_700Bold", color: colors.foreground, letterSpacing: -0.4 },

  content: { padding: 16, gap: 14 },

  // Hero
  hero: { borderRadius: radius.xl, padding: 24, gap: 6 },
  heroTitle: { fontSize: 22, fontWeight: "800", fontFamily: "Quicksand_700Bold", color: colors.white, letterSpacing: -0.5 },
  heroSub: { fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 20 },

  // Period selector
  periodRow: { flexDirection: "row", gap: 8 },
  periodBtn: {
    flex: 1, paddingVertical: 10, borderRadius: radius.md,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border,
    alignItems: "center",
  },
  periodBtnActive: { borderColor: colors.teal, backgroundColor: colors.teal },
  periodText: { fontSize: 12, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.muted },
  periodTextActive: { color: colors.white, fontWeight: "700", fontFamily: "Quicksand_700Bold" },

  // Shared
  priceRow: { flexDirection: "row", alignItems: "baseline", marginTop: 4 },
  priceHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  features: { paddingHorizontal: 16, paddingBottom: 4, gap: 9 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText: { fontSize: 14, color: colors.foreground, flex: 1 },
  featureTextWhite: { fontSize: 14, color: "rgba(255,255,255,0.92)", flex: 1 },
  currentPlanPill: {
    margin: 16, marginTop: 8, height: 44, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  currentPlanText: { fontSize: 14, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.muted },
  ctaInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  ctaText: { fontSize: 15, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.white },
  ctaWrap: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  pricingLabel: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Quicksand_600SemiBold",
    color: colors.secondary,
    textAlign: "center",
    marginBottom: 4,
  },
  pricingLabelWhite: { color: "rgba(255,255,255,0.9)" },
  renewFootnote: {
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
    marginTop: 4,
    fontFamily: "Quicksand_500Medium",
  },
  renewNote: {
    textAlign: "center", fontSize: 11, color: "#aaa",
    fontFamily: "Fraunces_500Medium_Italic",
  },
  renewNoteWhite: { color: "rgba(255,255,255,0.6)" },

  // Savings badge
  savingsBadge: {
    backgroundColor: "#FFF3D6", borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: "#F5C842",
  },
  savingsBadgeText: { fontSize: 11, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: "#8B6A00" },
  savingsBadgeWhite: {
    backgroundColor: "rgba(255,255,255,0.25)", borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  savingsBadgeWhiteText: { fontSize: 11, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.white },

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
  freeTierName: { fontSize: 16, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground },
  freePrice: { fontSize: 26, fontWeight: "800", fontFamily: "Quicksand_700Bold", color: colors.foreground, letterSpacing: -1 },
  freePriceSub: { fontSize: 13, color: colors.muted, alignSelf: "flex-end", paddingBottom: 3 },
  freeBadge: {
    backgroundColor: colors.surface, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  freeBadgeText: { fontSize: 11, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.muted },

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
  popularBadgeText: { fontSize: 11, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.white, letterSpacing: 0.3 },
  goCardTop: { padding: 16, paddingTop: 10, paddingBottom: 12 },
  goTierName: { fontSize: 16, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground },
  goPrice: { fontSize: 30, color: colors.teal, letterSpacing: -1, marginTop: 6 },
  perWeekLabel: { fontSize: 12, color: colors.muted, marginTop: 1 },
  billingNote: { fontSize: 11, color: colors.muted, fontStyle: "italic", marginTop: 3 },
  goCtaWrap: { height: 48, borderRadius: radius.full, overflow: "hidden", ...shadows.brand },

  // Trail card
  trailCard: { borderRadius: radius.xl, overflow: "hidden" },
  trailCardTop: { padding: 16, paddingBottom: 12 },
  trailTierName: { fontSize: 16, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.white },
  trailPrice: { fontSize: 30, color: colors.white, letterSpacing: -1, marginTop: 6 },
  trailPerWeekLabel: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 1 },
  trailBillingNote: { fontSize: 11, color: "rgba(255,255,255,0.6)", fontStyle: "italic", marginTop: 3 },
  trailCurrentPill: {
    margin: 16, marginTop: 8, height: 44, borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center",
  },
  trailCurrentText: { fontSize: 14, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.white },
  trailCtaWrap: { height: 48, borderRadius: radius.full, overflow: "hidden" },
  trailCta: {
    flex: 1, borderRadius: radius.full,
    backgroundColor: colors.white, alignItems: "center", justifyContent: "center",
  },
  trailCtaText: { fontSize: 15, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.teal },

  // Comparison
  manageSub: { alignSelf: "center", paddingVertical: 8 },
  manageSubText: { fontSize: 13, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.teal },
  restoreBtn: { alignSelf: "center", paddingVertical: 8 },
  restoreBtnText: { fontSize: 13, fontFamily: "Quicksand_400Regular", color: colors.muted },
  billingFootnote: {
    marginTop: 18,
    fontSize: 12,
    fontStyle: "italic",
    fontFamily: "Fraunces_500Medium_Italic",
    color: colors.muted,
    textAlign: "center",
  },
  compTitle: { fontSize: 10, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.muted, letterSpacing: 1.2, marginTop: 4 },
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
  compTierLabel: { fontSize: 12, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.muted },
  compTierLabelActive: { color: colors.teal },

  sunnyBanner: {
    position: "absolute", left: 16, right: 16, zIndex: 99,
    backgroundColor: "#FFFBEF", borderWidth: 1, borderColor: "#F5C842",
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10,
  },
  sunnyBannerText: { fontStyle: "italic", fontSize: 13, color: "#8B6A00", textAlign: "center" },
});
