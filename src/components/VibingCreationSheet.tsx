// Bottom sheet for starting (or ending) a vibing_status. Shorter and
// lower-friction than the formal "post a tandem" flow.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Switch,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, radius, shadows, gradients } from "../theme";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

const VIBING_EXPLAINER_KEY = "vibing_explainer_seen";

export type VibePreset =
  | "studying"
  | "coffeeing"
  | "eating"
  | "working_out"
  | "wandering";

interface Props {
  visible: boolean;
  onClose: () => void;
  onStarted?: () => void;
}

const VIBES: { key: VibePreset; label: string; emoji: string }[] = [
  { key: "studying",    label: "studying",    emoji: "📚" },
  { key: "coffeeing",   label: "coffee'ing",  emoji: "☕" },
  { key: "eating",      label: "eating",      emoji: "🍜" },
  { key: "working_out", label: "working out", emoji: "💪" },
  { key: "wandering",   label: "wandering",   emoji: "🚶" },
];

const DURATIONS = [
  { value: 30,  label: "30 min" },
  { value: 60,  label: "1 hour" },
  { value: 120, label: "2 hours" },
] as const;

interface ActiveVibe {
  id: string;
  vibe_preset: VibePreset;
  emoji: string | null;
  expires_at: string;
  location_label: string | null;
}

export function VibingCreationSheet({ visible, onClose, onStarted }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [selectedVibe, setSelectedVibe] = useState<VibePreset | null>(null);
  const [customEmoji, setCustomEmoji] = useState("");
  const [showEmojiInput, setShowEmojiInput] = useState(false);
  const [duration, setDuration] = useState<30 | 60 | 120>(60);
  const [trustedOnly, setTrustedOnly] = useState(false);

  const [locating, setLocating] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);

  const [activeVibe, setActiveVibe] = useState<ActiveVibe | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [endingVibe, setEndingVibe] = useState(false);
  const [showExplainer, setShowExplainer] = useState(false);

  // First-time explainer — shown once per device the first time the user
  // opens this sheet. Persisted via AsyncStorage (matches existing patterns).
  useEffect(() => {
    if (!visible) return;
    AsyncStorage.getItem(VIBING_EXPLAINER_KEY).then((seen) => {
      if (!seen) setShowExplainer(true);
    });
  }, [visible]);

  const dismissExplainer = () => {
    setShowExplainer(false);
    AsyncStorage.setItem(VIBING_EXPLAINER_KEY, "1").catch(() => { /* non-blocking */ });
  };

  // Reset state each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setSelectedVibe(null);
    setCustomEmoji("");
    setShowEmojiInput(false);
    setDuration(60);
    setTrustedOnly(false);
    setPermissionDenied(false);
    setCoords(null);
    setLocationLabel(null);
    setActiveVibe(null);
  }, [visible]);

  // Look up an existing active vibe so we can offer the "end vibe" flow.
  useEffect(() => {
    if (!visible || !user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("vibing_status")
        .select("id, vibe_preset, emoji, expires_at, location_label")
        .eq("user_id", user.id)
        .is("ended_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setActiveVibe((data as ActiveVibe | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, user]);

  const requestLocation = useCallback(async () => {
    setLocating(true);
    setPermissionDenied(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setPermissionDenied(true);
        setLocating(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setCoords({ lat, lng });
      // Reverse-geocode for the human label
      try {
        const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        const place = places[0];
        const label = place
          ? [place.name, place.city ?? place.subregion].filter(Boolean).join(", ")
          : null;
        setLocationLabel(label);
      } catch {
        setLocationLabel(null);
      }
    } catch (err) {
      console.warn("[VibingCreationSheet] location err:", err);
      setPermissionDenied(true);
    } finally {
      setLocating(false);
    }
  }, []);

  // Request location once the sheet is visible (skip if user already has an
  // active vibe — they're in the "end vibe" view first).
  useEffect(() => {
    if (!visible || activeVibe || coords || permissionDenied) return;
    requestLocation();
  }, [visible, activeVibe, coords, permissionDenied, requestLocation]);

  const handleEndExistingVibe = async () => {
    if (!activeVibe || endingVibe) return;
    setEndingVibe(true);
    try {
      await supabase
        .from("vibing_status")
        .update({ ended_at: new Date().toISOString() } as any)
        .eq("id", activeVibe.id);
      setActiveVibe(null);
    } catch (err) {
      console.warn("[VibingCreationSheet] end vibe failed:", err);
      Alert.alert("couldn't end your vibe.", "try again in a moment.");
    } finally {
      setEndingVibe(false);
    }
  };

  const handleStart = async () => {
    if (submitting) return;
    if (!user) return;
    if (!selectedVibe) return;
    if (!coords) {
      Alert.alert("we need your location to vibe.", "tap the retry button to grant access.");
      return;
    }
    setSubmitting(true);
    try {
      // End any existing active vibe before starting a new one.
      await supabase
        .from("vibing_status")
        .update({ ended_at: new Date().toISOString() } as any)
        .eq("user_id", user.id)
        .is("ended_at", null);

      const preset = VIBES.find((v) => v.key === selectedVibe)!;
      const emoji = customEmoji.trim() || preset.emoji;
      const expiresAt = new Date(Date.now() + duration * 60 * 1000).toISOString();

      const { error } = await supabase.from("vibing_status").insert({
        user_id: user.id,
        vibe_preset: selectedVibe,
        emoji,
        duration_minutes: duration,
        audience: trustedOnly ? "trusted_only" : "nearby_and_trusted",
        current_lat: coords.lat,
        current_lng: coords.lng,
        location_label: locationLabel,
        expires_at: expiresAt,
      } as any);

      if (error) {
        console.warn("[VibingCreationSheet] insert failed:", error.message);
        Alert.alert("couldn't start vibing.", "try again in a moment.");
        return;
      }

      onStarted?.();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const canStart = !!selectedVibe && !!coords && !submitting;

  const activeRemainingMinutes = useMemo(() => {
    if (!activeVibe) return 0;
    return Math.max(0, Math.round((new Date(activeVibe.expires_at).getTime() - Date.now()) / 60000));
  }, [activeVibe]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable
          style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 14) + 8 }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={s.handle} />

          {/* Header */}
          <View style={s.headerRow}>
            <Text style={s.title}>start vibing</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <Text style={s.helper}>
            tell people what you're up to. they can join if they're nearby.
          </Text>

          <ScrollView
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingBottom: 12 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Existing-active-vibe banner */}
            {activeVibe ? (
              <View style={s.activeVibeCard}>
                <Text style={s.activeVibeLabel}>you're already vibing</Text>
                <Text style={s.activeVibeText}>
                  {activeVibe.emoji ?? VIBES.find((v) => v.key === activeVibe.vibe_preset)?.emoji}
                  {"  "}
                  {activeVibe.vibe_preset.replace("_", " ")} ·{" "}
                  {activeRemainingMinutes} min left
                </Text>
                <TouchableOpacity
                  onPress={handleEndExistingVibe}
                  disabled={endingVibe}
                  style={s.endVibeBtn}
                  activeOpacity={0.85}
                >
                  <Text style={s.endVibeText}>
                    {endingVibe ? "ending..." : "end vibe"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Vibe picker */}
            <Text style={s.sectionLabel}>what's the vibe?</Text>
            <View style={s.vibeGrid}>
              {VIBES.map((v) => {
                const selected = selectedVibe === v.key;
                return (
                  <TouchableOpacity
                    key={v.key}
                    onPress={() => setSelectedVibe(selected ? null : v.key)}
                    activeOpacity={0.85}
                    style={[s.vibeChip, selected && s.vibeChipSelected]}
                  >
                    <Text style={s.vibeEmoji}>{v.emoji}</Text>
                    <Text
                      style={[s.vibeChipText, selected && s.vibeChipTextSelected]}
                    >
                      {v.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Optional emoji override */}
            {showEmojiInput ? (
              <TextInput
                value={customEmoji}
                onChangeText={(v) => setCustomEmoji(v.slice(0, 4))}
                placeholder="🌧️"
                placeholderTextColor={colors.muted}
                style={s.emojiInput}
                autoFocus
              />
            ) : (
              <TouchableOpacity
                onPress={() => setShowEmojiInput(true)}
                activeOpacity={0.7}
                style={s.emojiToggle}
              >
                <Text style={s.emojiToggleText}>use a different emoji?</Text>
              </TouchableOpacity>
            )}

            {/* Duration */}
            <Text style={s.sectionLabel}>how long?</Text>
            <View style={s.durationRow}>
              {DURATIONS.map((d) => {
                const selected = duration === d.value;
                return (
                  <TouchableOpacity
                    key={d.value}
                    onPress={() => setDuration(d.value)}
                    activeOpacity={0.85}
                    style={[s.durationChip, selected && s.durationChipSelected]}
                  >
                    <Text
                      style={[
                        s.durationChipText,
                        selected && s.durationChipTextSelected,
                      ]}
                    >
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Audience */}
            <Text style={s.sectionLabel}>who sees it?</Text>
            <View style={s.audienceRow}>
              <Text style={s.audienceLabel}>
                show only to people i've tandem'd with
              </Text>
              <Switch
                value={trustedOnly}
                onValueChange={setTrustedOnly}
                trackColor={{ false: colors.border, true: colors.teal }}
                thumbColor={colors.white}
              />
            </View>

            {/* Location */}
            <View style={s.locationRow}>
              {locating ? (
                <>
                  <ActivityIndicator color={colors.teal} size="small" />
                  <Text style={s.locationText}>finding you...</Text>
                </>
              ) : permissionDenied ? (
                <>
                  <Ionicons name="warning-outline" size={14} color="#F59E0B" />
                  <Text style={s.locationError}>
                    vibing needs your location to find nearby tandemers.
                  </Text>
                  <TouchableOpacity onPress={requestLocation} activeOpacity={0.7}>
                    <Text style={s.locationRetry}>retry</Text>
                  </TouchableOpacity>
                </>
              ) : coords ? (
                <>
                  <Ionicons name="location" size={14} color={colors.teal} />
                  <Text style={s.locationText}>
                    {locationLabel ?? "you're set"}
                  </Text>
                </>
              ) : null}
            </View>
          </ScrollView>

          {/* Start button */}
          <TouchableOpacity
            onPress={handleStart}
            disabled={!canStart}
            activeOpacity={0.88}
            style={[s.startBtnWrap, !canStart && s.startBtnDisabled]}
          >
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.startBtn}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={s.startBtnText}>start vibing</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Pressable>
      </Pressable>

      {/* One-time explainer — first opener only */}
      <Modal
        visible={showExplainer}
        animationType="fade"
        transparent
        onRequestClose={dismissExplainer}
      >
        <Pressable style={s.explainerBackdrop} onPress={dismissExplainer}>
          <Pressable
            style={s.explainerCard}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={s.explainerTitle}>what's vibing?</Text>
            <Text style={s.explainerBody}>
              vibing is a quick way to say "i'm here, come hang." less commitment than posting a tandem. when you start vibing, nearby tandemers and your trusted friends can see it for the duration you pick.
            </Text>
            <TouchableOpacity
              onPress={dismissExplainer}
              activeOpacity={0.88}
              style={s.explainerBtnWrap}
            >
              <LinearGradient
                colors={gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.explainerBtn}
              >
                <Text style={s.explainerBtnText}>got it</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    ...shadows.float,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 18,
    fontFamily: "Quicksand_500Medium",
    fontWeight: "500",
    color: colors.foreground,
  },
  helper: {
    fontSize: 13,
    fontFamily: "Fraunces_500Medium_Italic",
    fontStyle: "italic",
    color: colors.muted,
    marginTop: 6,
    marginBottom: 14,
  },
  activeVibeCard: {
    backgroundColor: colors.tintTeal,
    borderColor: colors.teal,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14,
    gap: 6,
    marginBottom: 16,
  },
  activeVibeLabel: {
    fontSize: 11,
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
    color: colors.teal,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  activeVibeText: {
    fontSize: 14,
    fontFamily: "Quicksand_600SemiBold",
    fontWeight: "600",
    color: colors.foreground,
  },
  endVibeBtn: {
    marginTop: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.destructive,
  },
  endVibeText: {
    fontSize: 13,
    color: colors.destructive,
    fontFamily: "Quicksand_600SemiBold",
    fontWeight: "600",
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
    color: colors.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 4,
    marginBottom: 10,
  },
  vibeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  vibeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  vibeChipSelected: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  vibeEmoji: {
    fontSize: 18,
    fontFamily: "System",
  },
  vibeChipText: {
    fontSize: 14,
    color: colors.foreground,
    fontFamily: "Quicksand_500Medium",
  },
  vibeChipTextSelected: {
    color: colors.white,
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
  },
  emojiToggle: {
    paddingVertical: 6,
    marginBottom: 6,
  },
  emojiToggleText: {
    fontSize: 12,
    fontStyle: "italic",
    fontFamily: "Fraunces_500Medium_Italic",
    color: colors.teal,
  },
  emojiInput: {
    height: 44,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    fontSize: 22,
    color: colors.foreground,
    marginBottom: 14,
  },
  durationRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  durationChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: "center",
  },
  durationChipSelected: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  durationChipText: {
    fontSize: 14,
    color: colors.foreground,
    fontFamily: "Quicksand_500Medium",
  },
  durationChipTextSelected: {
    color: colors.white,
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
  },
  audienceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
  audienceLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.foreground,
    fontFamily: "Quicksand_500Medium",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 8,
    paddingBottom: 14,
  },
  locationText: {
    fontSize: 13,
    color: colors.secondary,
    fontFamily: "Quicksand_500Medium",
  },
  locationError: {
    flex: 1,
    fontSize: 12,
    color: colors.muted,
    fontFamily: "Quicksand_500Medium",
  },
  locationRetry: {
    fontSize: 13,
    color: colors.teal,
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  startBtnWrap: {
    borderRadius: radius.full,
    overflow: "hidden",
    marginTop: 8,
    ...shadows.brand,
  },
  startBtnDisabled: {
    opacity: 0.5,
  },
  startBtn: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  startBtnText: {
    fontSize: 16,
    color: colors.white,
    fontFamily: "Quicksand_500Medium",
    fontWeight: "500",
  },
  explainerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  explainerCard: {
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    padding: 24,
    width: "100%",
    ...shadows.float,
  },
  explainerTitle: {
    fontSize: 18,
    fontFamily: "Quicksand_500Medium",
    fontWeight: "500",
    color: colors.foreground,
    textAlign: "center",
    marginBottom: 10,
  },
  explainerBody: {
    fontSize: 14,
    fontStyle: "italic",
    fontFamily: "Fraunces_500Medium_Italic",
    color: colors.secondary,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 20,
  },
  explainerBtnWrap: {
    borderRadius: radius.full,
    overflow: "hidden",
    ...shadows.brand,
  },
  explainerBtn: {
    paddingVertical: 14,
    alignItems: "center",
  },
  explainerBtnText: {
    fontSize: 15,
    color: colors.white,
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
  },
});
