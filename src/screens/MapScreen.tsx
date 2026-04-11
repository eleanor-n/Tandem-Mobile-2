import React, { useRef, useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Modal, Animated,
} from "react-native";
import { useFonts, Caveat_400Regular, Caveat_700Bold } from "@expo-google-fonts/caveat";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomNav } from "../components/BottomNav";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useMembershipTier } from "../hooks/useMembershipTier";
import { colors, radius, shadows } from "../theme";
import { getSunnyResponse } from "../lib/sunny";

const INITIAL_REGION = {
  latitude: 40.349,
  longitude: -74.659,
  latitudeDelta: 0.10,
  longitudeDelta: 0.10,
};


const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#e9e9e9" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
];

// Emoji gradient pin

interface MapScreenProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
  onPostPress?: () => void;
  onPostPressWithLocation?: (loc: { name: string; lat: number; lng: number }) => void;
}

export const MapScreen = ({ activeTab, onTabPress, onPostPress, onPostPressWithLocation }: MapScreenProps) => {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({ Caveat_400Regular, Caveat_700Bold });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);
  const [mapActivities, setMapActivities] = useState<any[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const { user } = useAuth();
  const { isLimited, incrementImIn } = useMembershipTier();
  const [requestedSet, setRequestedSet] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sunnyText = useRef<string | null>(null);
  const [sunnyVisible, setSunnyVisible] = useState(false);
  const sunnyOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fetchMapActivities = async () => {
      const { data } = await supabase
        .from("activities")
        .select("id, title, location_name, location_lat, location_lng, activity_date, activity_time, tags")
        .eq("status", "active")
        .not("location_lat", "is", null)
        .not("location_lng", "is", null);
      setMapActivities(data ?? []);
      setMapLoaded(true);
    };
    fetchMapActivities();
  }, []);

  useEffect(() => {
    if (!mapLoaded) return;
    if (mapActivities.length === 0) {
      getSunnyResponse({ context: "mapEmpty" }).then(text => {
        sunnyText.current = text;
        setTimeout(() => {
          setSunnyVisible(true);
          Animated.timing(sunnyOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
        }, 700);
      });
    } else {
      setSunnyVisible(false);
    }
  }, [mapLoaded, mapActivities]);

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  };

  const handleImIn = async (activityId: string) => {
    if (isLimited) {
      showToast("you've hit your monthly limit. upgrade to tandem go for more.");
      return;
    }
    try {
      if (user) {
        await supabase.from("join_requests").insert({
          activity_id: activityId,
          requester_id: user.id,
          status: "pending",
        } as any);
      }
    } catch { /* join_requests table may not exist yet */ }
    await incrementImIn();
    setRequestedSet(prev => new Set([...prev, activityId]));
    const act = mapActivities.find((a: any) => a.id === activityId);
    const subtitle = await getSunnyResponse({
      context: "imIn",
      activityTitle: act?.title ?? "the activity",
      hostName: act?.host?.name ?? "them",
    });
    showToast(subtitle);
    setSelectedActivity(null);
  };

  const saveActivityForLater = async (act: any) => {
    showToast("saved for later.");
    if (!user) return;
    try {
      const { data } = await supabase.from("profiles").select("saved_activities").eq("user_id", user.id).single();
      const existing: any[] = (data?.saved_activities as any[]) || [];
      if (existing.some((a: any) => a.id === act.id)) return;
      const entry = { id: act.id, name: act.title, activity: act.title, location: act.location, saved_at: new Date().toISOString() };
      await supabase.from("profiles").update({ saved_activities: [...existing, entry] } as any).eq("user_id", user.id);
    } catch { /* saved_activities column may not exist yet */ }
  };

  return (
    <View style={s.container}>
      {/* Full-screen map */}
      <MapView
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_DEFAULT}
        initialRegion={INITIAL_REGION}
        customMapStyle={MAP_STYLE}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {mapActivities.map((activity: any) => (
          <Marker
            key={activity.id}
            coordinate={{
              latitude: activity.location_lat,
              longitude: activity.location_lng,
            }}
            title={activity.title}
            description={`${activity.location_name} · ${activity.activity_date}`}
          />
        ))}
      </MapView>

      {/* Floating search bar */}
      <View style={[s.searchBar, { top: insets.top + 12 }]}>
        <Ionicons name="search" size={16} color={colors.teal} />
        <Text style={s.searchText}>search activities near you</Text>
        <TouchableOpacity
          style={s.filterBtn}
          onPress={() => showToast("filters coming soon.")}
          activeOpacity={0.7}
        >
          <Ionicons name="options-outline" size={18} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {/* Side buttons */}
      <View style={[s.sideButtons, { top: insets.top + 72 }]}>
        <TouchableOpacity style={s.sideBtn} onPress={() => showToast("centering on your location.")} activeOpacity={0.8}>
          <Ionicons name="navigate-outline" size={18} color={colors.teal} />
        </TouchableOpacity>
        <TouchableOpacity style={s.sideBtn} onPress={() => showToast("layers coming soon.")} activeOpacity={0.8}>
          <Ionicons name="layers-outline" size={18} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {/* Bottom peek panel */}
      <View style={[s.bottomPanel, { paddingBottom: 80 + insets.bottom }]}>
        {/* Panel header */}
        <View style={s.panelHeader}>
          <Text style={s.panelTitle}>nearby</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={s.seeAll}>see all</Text>
          </TouchableOpacity>
        </View>

        {/* Horizontal card scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.cardsContent}
        >
          {mapActivities.map((act: any) => {
            const isSelected = selectedId === act.id;
            return (
              <TouchableOpacity
                key={act.id}
                style={[s.nearbyCard, isSelected && s.nearbyCardSelected]}
                onPress={() => {
                  if (onPostPressWithLocation && act.location_lat != null && act.location_lng != null) {
                    onPostPressWithLocation({
                      name: act.location_name ?? act.title,
                      lat: act.location_lat,
                      lng: act.location_lng,
                    });
                  } else if (act?.id && act?.title) {
                    setSelectedId(act.id);
                    setSelectedActivity(act);
                  }
                }}
                activeOpacity={0.9}
              >
                <View style={s.nearbyBody}>
                  <Text style={s.nearbyTitle} numberOfLines={1}>{act.title}</Text>
                  <Text style={s.nearbyLocation} numberOfLines={1}>{act.location_name}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {!!toast && (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}

      {sunnyVisible && sunnyText.current && mapActivities.length === 0 ? (
        <Animated.Text style={[ms.sunnyLine, { opacity: sunnyOpacity, bottom: 80 + insets.bottom }]} numberOfLines={2}>
          {sunnyText.current}
        </Animated.Text>
      ) : null}

      <BottomNav activeTab={activeTab} onTabPress={onTabPress} onPostPress={onPostPress} />

      {/* Activity detail modal */}
      <Modal
        visible={!!selectedActivity}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedActivity(null)}
      >
        {selectedActivity && selectedActivity.id && selectedActivity.title && (() => {
          const act = selectedActivity;
          return (
            <View style={m.container}>
              {/* Handle + close */}
              <View style={m.handle} />
              <TouchableOpacity
                style={m.closeBtn}
                onPress={() => setSelectedActivity(null)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={colors.muted} />
              </TouchableOpacity>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
                {/* Photo */}
                <View style={m.photoWrap}>
                  <Image source={{ uri: act.photo }} style={m.photo} resizeMode="cover" />
                  {/* Category pill */}
                  <View style={m.categoryPill}>
                    <Ionicons name={act.icon as any} size={12} color={colors.foreground} />
                    <Text style={m.categoryPillText}>{act.category}</Text>
                  </View>
                </View>

                {/* Body */}
                <View style={m.body}>
                  <Text style={m.title}>{act.title}</Text>

                  <View style={m.metaRow}>
                    <Ionicons name="location-outline" size={14} color={colors.teal} />
                    <Text style={m.metaText}>{act.location} · {act.distance}</Text>
                  </View>
                  <View style={m.metaRow}>
                    <Ionicons name="calendar-outline" size={14} color={colors.muted} />
                    <Text style={m.metaText}>{act.date}</Text>
                  </View>

                  {/* Vibe */}
                  <View style={m.vibeBox}>
                    <Text style={m.vibeText}>"{act.vibe}"</Text>
                  </View>

                  {/* Going */}
                  <View style={m.goingRow}>
                    <Ionicons name="people-outline" size={14} color={colors.muted} />
                    <Text style={m.goingText}>{act.goingCount} going</Text>
                  </View>

                  {/* Host strip */}
                  {act.host && (
                    <View style={m.hostStrip}>
                      <Image source={{ uri: act.host.photo }} style={m.hostAvatar} />
                      <View style={{ flex: 1 }}>
                        <Text style={m.hostLabel}>posted by <Text style={m.hostName}>{act.host.name}</Text></Text>
                        <Text style={m.hostBio} numberOfLines={1}>{act.host.bio}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </ScrollView>

              {/* Sticky action bar */}
              <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 28, gap: 10, borderTopWidth: 0.5, borderTopColor: "#E0D8C8", backgroundColor: "#FAFAF8" }}>
                <TouchableOpacity
                  onPress={() => setSelectedActivity(null)}
                  activeOpacity={0.8}
                  style={{ flex: 1, height: 52, borderRadius: 100, borderWidth: 1, borderColor: "#E0D8C8", alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ fontFamily: fontsLoaded ? "Caveat_400Regular" : undefined, fontSize: 16, color: "#888" }}>pass</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { saveActivityForLater(act); setSelectedActivity(null); }}
                  activeOpacity={0.8}
                  style={{ flex: 1.4, height: 52, borderRadius: 100, borderWidth: 1.5, borderColor: "#1D9E75", alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ fontFamily: fontsLoaded ? "Caveat_400Regular" : undefined, fontSize: 16, color: "#1D9E75" }}>save for later</Text>
                </TouchableOpacity>
                {!requestedSet.has(act.id) ? (
                  <TouchableOpacity
                    onPress={() => handleImIn(act.id)}
                    activeOpacity={0.88}
                    style={{ flex: 2, height: 52, borderRadius: 100, backgroundColor: "#1D9E75", alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ fontFamily: fontsLoaded ? "Caveat_700Bold" : undefined, fontSize: 18, color: "white" }}>i'm in</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ flex: 2, height: 52, borderRadius: 100, borderWidth: 1, borderColor: "#E0D8C8", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontFamily: fontsLoaded ? "Caveat_400Regular" : undefined, fontSize: 16, color: "#888" }}>requested</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })()}
      </Modal>
    </View>
  );
};


const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Floating search bar
  searchBar: {
    position: "absolute", left: 16, right: 16, zIndex: 20,
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: colors.white, borderRadius: radius.full,
    paddingLeft: 16, paddingRight: 8, paddingVertical: 12,
    ...shadows.float,
  },
  searchText: { flex: 1, fontSize: 14, color: colors.muted, fontWeight: "500", fontFamily: "Quicksand_500Medium" },
  filterBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },

  // Side buttons
  sideButtons: { position: "absolute", right: 16, zIndex: 15, gap: 10 },
  sideBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.white, alignItems: "center", justifyContent: "center",
    ...shadows.card,
  },

  // Bottom panel
  bottomPanel: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 12,
  },
  panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 12 },
  panelTitle: { fontSize: 18, fontWeight: "800", fontFamily: "Quicksand_700Bold", color: colors.foreground, letterSpacing: -0.4 },
  seeAll: { fontSize: 14, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.teal },
  cardsContent: { paddingHorizontal: 16, paddingBottom: 8, gap: 12, flexDirection: "row" },

  // Nearby card
  nearbyCard: {
    width: 160, backgroundColor: colors.white, borderRadius: radius.lg,
    overflow: "hidden", borderWidth: 1.5, borderColor: colors.border,
    ...shadows.card,
  },
  nearbyCardSelected: { borderColor: colors.teal },
  nearbyPhoto: { width: "100%", height: 88, backgroundColor: colors.surface },
  nearbyBody: { padding: 10, gap: 3 },
  nearbyDistance: { fontSize: 10, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.teal, letterSpacing: 0.4 },
  nearbyTitle: { fontSize: 13, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground, letterSpacing: -0.2 },
  nearbyLocation: { fontSize: 11, color: colors.muted },

  // Toast
  toast: {
    position: "absolute", bottom: 160, alignSelf: "center",
    backgroundColor: "rgba(15,23,42,0.85)", borderRadius: radius.full,
    paddingHorizontal: 20, paddingVertical: 10, zIndex: 50,
  },
  toastText: { fontSize: 13, color: colors.white, fontWeight: "500", fontFamily: "Quicksand_500Medium" },
});

// Modal styles
const m = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  handle: {
    width: 36, height: 4, backgroundColor: colors.border,
    borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 4,
  },
  closeBtn: {
    position: "absolute", top: 16, right: 16, zIndex: 10,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center",
  },

  // Photo
  photoWrap: { position: "relative" },
  photo: { width: "100%", height: 260, backgroundColor: colors.surface },
  categoryPill: {
    position: "absolute", bottom: 12, left: 12,
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5,
  },
  categoryPillText: { fontSize: 12, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground },

  // Body
  body: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: "800", fontFamily: "Quicksand_700Bold", color: colors.foreground, letterSpacing: -0.5 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontSize: 13, color: colors.muted },

  vibeBox: {
    backgroundColor: "#F0FDFB",
    borderLeftWidth: 3, borderLeftColor: colors.teal,
    borderRadius: 6, padding: 12,
  },
  vibeText: { fontSize: 13, fontStyle: "italic", color: colors.secondary, lineHeight: 20 },

  goingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  goingText: { fontSize: 13, color: colors.muted },

  hostStrip: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  hostAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface },
  hostLabel: { fontSize: 12, color: colors.muted },
  hostName: { fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground },
  hostBio: { fontSize: 12, color: colors.muted, marginTop: 1 },

});

const ms = StyleSheet.create({
  sunnyLine: {
    position: "absolute", left: 0, right: 0,
    textAlign: "center", fontStyle: "italic",
    fontSize: 13, color: "#888",
    paddingHorizontal: 24,
  },
});
