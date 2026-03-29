import React, { useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomNav } from "../components/BottomNav";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { colors, radius, shadows, gradients } from "../theme";

const INITIAL_REGION = {
  latitude: 40.349,
  longitude: -74.659,
  latitudeDelta: 0.10,
  longitudeDelta: 0.10,
};

const ACTIVITIES = [
  {
    id: "1",
    title: "tennis session",
    location: "public courts",
    distance: "0.4 mi",
    emoji: "🎾",
    photo: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=400&h=300&fit=crop",
    date: "Sat · 10am",
    goingCount: 2,
    coordinate: { latitude: 40.358, longitude: -74.668 },
    host: { name: "maya", photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face" },
  },
  {
    id: "2",
    title: "morning coffee",
    location: "blue bottle",
    distance: "1.2 mi",
    emoji: "☕",
    photo: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop",
    date: "Sun · 9am",
    goingCount: 3,
    coordinate: { latitude: 40.342, longitude: -74.651 },
    host: { name: "alex", photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face" },
  },
  {
    id: "3",
    title: "farmers market run",
    location: "nassau st",
    distance: "0.8 mi",
    emoji: "🛍",
    photo: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=400&h=300&fit=crop",
    date: "Sat · 9am",
    goingCount: 5,
    coordinate: { latitude: 40.353, longitude: -74.662 },
    host: { name: "sam", photo: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop&crop=face" },
  },
  {
    id: "4",
    title: "ridge hike",
    location: "sourland mountain",
    distance: "4.1 mi",
    emoji: "🥾",
    photo: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&h=300&fit=crop",
    date: "Sun · 7am",
    goingCount: 4,
    coordinate: { latitude: 40.363, longitude: -74.673 },
    host: { name: "riley", photo: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&h=100&fit=crop&crop=face" },
  },
];

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
const ActivityPin = ({
  item,
  selected,
  onPress,
}: {
  item: typeof ACTIVITIES[0];
  selected: boolean;
  onPress: () => void;
}) => (
  <Marker coordinate={item.coordinate} onPress={onPress} tracksViewChanges={false} anchor={{ x: 0.5, y: 1 }}>
    <View style={pinS.wrapper}>
      {selected ? (
        <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={pinS.pinSelected}>
          <Text style={pinS.emoji} allowFontScaling={false}>{item.emoji}</Text>
        </LinearGradient>
      ) : (
        <View style={pinS.pin}>
          <Text style={pinS.emoji} allowFontScaling={false}>{item.emoji}</Text>
        </View>
      )}
      <View style={[pinS.tail, selected && pinS.tailSelected]} />
    </View>
  </Marker>
);

interface MapScreenProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
}

export const MapScreen = ({ activeTab, onTabPress }: MapScreenProps) => {
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imInSet, setImInSet] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  };

  const saveActivityForLater = async (act: typeof ACTIVITIES[0]) => {
    if (!user) return;
    try {
      const { data } = await supabase.from("profiles").select("saved_activities").eq("user_id", user.id).single();
      const existing: any[] = (data?.saved_activities as any[]) || [];
      if (existing.some((a: any) => a.id === act.id)) return;
      const entry = { id: act.id, name: act.title, activity: act.emoji, location: act.location, saved_at: new Date().toISOString() };
      await supabase.from("profiles").update({ saved_activities: [...existing, entry] } as any).eq("user_id", user.id);
    } catch { /* saved_activities column may not exist yet */ }
  };

  const handleImIn = (actId: string) => {
    if (imInSet.has(actId)) return;
    setImInSet(prev => new Set([...prev, actId]));
    const act = ACTIVITIES.find(a => a.id === actId);
    showToast(`you're in for ${act?.title ?? "it"}! 🎉`);
  };

  const handleLater = (act: typeof ACTIVITIES[0]) => {
    saveActivityForLater(act);
    showToast("saved for later.");
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
        {ACTIVITIES.map(act => (
          <ActivityPin
            key={act.id}
            item={act}
            selected={selectedId === act.id}
            onPress={() => setSelectedId(prev => (prev === act.id ? null : act.id))}
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
          {ACTIVITIES.map(act => {
            const isIn = imInSet.has(act.id);
            const isSelected = selectedId === act.id;
            return (
              <TouchableOpacity
                key={act.id}
                style={[s.nearbyCard, isSelected && s.nearbyCardSelected]}
                onPress={() => setSelectedId(prev => prev === act.id ? null : act.id)}
                activeOpacity={0.9}
              >
                <Image source={{ uri: act.photo }} style={s.nearbyPhoto} resizeMode="cover" />
                <View style={s.nearbyBody}>
                  <Text style={s.nearbyDistance}>{act.distance}</Text>
                  <Text style={s.nearbyTitle} numberOfLines={1}>{act.title}</Text>
                  <Text style={s.nearbyLocation} numberOfLines={1}>{act.location}</Text>
                  <TouchableOpacity
                    onPress={() => isIn ? handleLater(act) : handleImIn(act.id)}
                    activeOpacity={0.88}
                    style={s.imInWrap}
                  >
                    <LinearGradient
                      colors={isIn ? ["#E5E7EB", "#E5E7EB"] : gradients.brand}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={s.imInBtn}
                    >
                      <Text style={[s.imInText, isIn && { color: colors.muted }]}>
                        {isIn ? "going ✓" : "i'm in"}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
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

      <BottomNav activeTab={activeTab} onTabPress={onTabPress} />
    </View>
  );
};

const pinS = StyleSheet.create({
  wrapper: { alignItems: "center" },
  pin: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18, shadowRadius: 8, elevation: 8,
    borderWidth: 2, borderColor: colors.white,
  },
  pinSelected: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.teal, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 12,
  },
  emoji: { fontSize: 20, fontFamily: undefined },
  tail: { width: 2, height: 6, backgroundColor: colors.white, marginTop: -1 },
  tailSelected: { backgroundColor: colors.teal },
});

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
  searchText: { flex: 1, fontSize: 14, color: colors.muted, fontWeight: "500" },
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
  panelTitle: { fontSize: 18, fontWeight: "800", color: colors.foreground, letterSpacing: -0.4 },
  seeAll: { fontSize: 14, fontWeight: "600", color: colors.teal },
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
  nearbyDistance: { fontSize: 10, fontWeight: "700", color: colors.teal, letterSpacing: 0.4 },
  nearbyTitle: { fontSize: 13, fontWeight: "700", color: colors.foreground, letterSpacing: -0.2 },
  nearbyLocation: { fontSize: 11, color: colors.muted },
  imInWrap: { marginTop: 6, borderRadius: radius.full, overflow: "hidden" },
  imInBtn: { paddingVertical: 6, alignItems: "center", justifyContent: "center", borderRadius: radius.full },
  imInText: { fontSize: 12, fontWeight: "700", color: colors.white },

  // Toast
  toast: {
    position: "absolute", bottom: 160, alignSelf: "center",
    backgroundColor: "rgba(15,23,42,0.85)", borderRadius: radius.full,
    paddingHorizontal: 20, paddingVertical: 10, zIndex: 50,
  },
  toastText: { fontSize: 13, color: colors.white, fontWeight: "500" },
});
