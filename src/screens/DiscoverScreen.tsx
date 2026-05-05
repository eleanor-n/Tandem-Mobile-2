import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import PlacesAutocomplete from "expo-google-places-autocomplete";
import type { Place } from "expo-google-places-autocomplete";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFonts, Caveat_400Regular } from "@expo-google-fonts/caveat";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BottomNav } from "../components/BottomNav";
import SunnyAvatar from "../components/SunnyAvatar";
import { UpsellSheet } from "../components/UpsellSheet";
import { AppWalkthrough } from "../components/AppWalkthrough";
import { useMembershipTier } from "../hooks/useMembershipTier";
import { supabase } from "../lib/supabase";
import { logError } from "../lib/errorLogger";
import { getSunnyResponse } from "../lib/sunny";
import { useAuth } from "../contexts/AuthContext";
import { colors, radius, shadows, gradients } from "../theme";
import { TrustStack } from "../components/safety/TrustStack";
import { SafetyCheckIn } from "../components/safety/SafetyCheckIn";
import { PrivateLocationNudge, shouldNudgeLocation } from "../components/safety/PrivateLocationNudge";
import { FirstJoinReminder } from "../components/safety/FirstJoinReminder";
import { hasSeenFirstJoinReminder, markFirstJoinReminderSeen } from "../lib/safetyStorage";


const calculateAge = (birthday: string | null): number | null => {
  if (!birthday) return null;
  return Math.floor(
    (Date.now() - new Date(birthday).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
};


const FALLBACK_PHOTOS: Record<string, string> = {
  coffee: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800",
  hiking: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800",
  markets: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800",
  concerts: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800",
  fitness: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800",
  default: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800",
};

const CATEGORY_ICON: Record<string, string> = {
  coffee: "cafe-outline",
  hiking: "walk-outline",
  markets: "bag-outline",
  concerts: "musical-notes-outline",
  fitness: "barbell-outline",
  sports: "football-outline",
  default: "compass-outline",
};

const CATEGORY_GRADIENT: Record<string, [string, string]> = {
  coffee:   ["#C8873A", "#E8B88A"],
  hiking:   ["#2D6A4F", "#52B788"],
  outdoors: ["#2D6A4F", "#52B788"],
  markets:  ["#7B2D8B", "#C77DFF"],
  shopping: ["#7B2D8B", "#C77DFF"],
  concerts: ["#1A1A2E", "#E94560"],
  music:    ["#1A1A2E", "#E94560"],
  fitness:  ["#0077B6", "#00B4D8"],
  gym:      ["#0077B6", "#00B4D8"],
  workout:  ["#0077B6", "#00B4D8"],
  sports:   ["#007200", "#70E000"],
  food:     ["#FF6B6B", "#FF8E53"],
  art:      ["#F72585", "#7209B7"],
  culture:  ["#F72585", "#7209B7"],
  study:    ["#3A0CA3", "#4CC9F0"],
  academic: ["#3A0CA3", "#4CC9F0"],
  travel:   ["#F77F00", "#FCBF49"],
  explore:  ["#F77F00", "#FCBF49"],
  default:  ["#2DD4BF", "#3B82F6"],
};

// Returns gradient colors for a given activity tag
const getCardGradient = (tag: string): [string, string] => {
  const key = (tag ?? "").toLowerCase();
  return CATEGORY_GRADIENT[key] ?? CATEGORY_GRADIENT.default;
};

const calcDistanceMiles = (
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number => {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const FILTERS = [
  { key: "all",      label: "all",       icon: "" },
  { key: "coffee",   label: "coffee",    icon: "cafe-outline" },
  { key: "hiking",   label: "hiking",    icon: "walk-outline" },
  { key: "markets",  label: "markets",   icon: "bag-outline" },
  { key: "concerts", label: "concerts",  icon: "musical-notes-outline" },
  { key: "fitness",  label: "fitness",   icon: "barbell-outline" },
  { key: "sports",   label: "sports",    icon: "football-outline" },
];


interface DiscoverScreenProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
  onMessagesPress?: () => void;
  onMembershipPress?: () => void;
  onOpenChat?: (convo: { id: string; name: string; photo: string }) => void;
  openPostModal?: boolean;
  onPostModalOpened?: () => void;
  startOnMyActivity?: boolean;
  postPrefill?: { name: string; lat: number; lng: number } | null;
  onPostPrefillConsumed?: () => void;
  onSafetyPress?: () => void;
}

type LocationAutocompleteProps = {
  value: string;
  placeholder?: string;
  onSelect: (place: { description: string; lat: number; lng: number; raw: Place }) => void;
};

const LocationAutocomplete = ({ value, placeholder, onSelect }: LocationAutocompleteProps) => {
  const [query, setQuery] = useState(value);
  const [predictions, setPredictions] = useState<Place[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const handleChangeText = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setPredictions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await PlacesAutocomplete.findPlaces(text);
        const places = result?.places ?? [];
        console.log("[PLACES]", { query: text, resultsCount: places.length, error: null });
        setPredictions(places);
      } catch (err: any) {
        console.log("[PLACES]", { query: text, resultsCount: 0, error: err?.message ?? String(err) });
        setPredictions([]);
      }
    }, 250);
  };

  const handlePick = async (place: Place) => {
    try {
      const details = await PlacesAutocomplete.placeDetails(place.placeId);
      const lat = details.coordinate?.latitude;
      const lng = details.coordinate?.longitude;
      if (typeof lat === "number" && typeof lng === "number") {
        onSelect({ description: place.fullText || place.description, lat, lng, raw: place });
      }
      setQuery(place.fullText || place.description);
      setPredictions([]);
    } catch (err: any) {
      console.log("[PLACES]", { stage: "placeDetails", placeId: place.placeId, error: err?.message ?? String(err) });
    }
  };

  return (
    <View style={{ position: "relative", zIndex: 9999 }}>
      <TextInput
        value={query}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={modalLocationS.input}
        autoCorrect={false}
        returnKeyType="search"
      />
      {predictions.length > 0 && (
        <View style={modalLocationS.listView}>
          {predictions.map((p) => (
            <TouchableOpacity
              key={p.placeId}
              style={modalLocationS.row}
              onPress={() => handlePick(p)}
              activeOpacity={0.7}
            >
              <Text style={modalLocationS.rowText} numberOfLines={1}>
                {p.fullText || p.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const modalLocationS = StyleSheet.create({
  input: {
    height: 50,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    fontSize: 14,
    color: colors.foreground,
    fontFamily: "Quicksand_700Bold",
  },
  listView: {
    position: "absolute",
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 9999,
    elevation: 9999,
    overflow: "hidden",
  },
  row: {
    padding: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowText: {
    fontSize: 14,
    color: colors.foreground,
    fontFamily: "Quicksand_500Medium",
  },
});

export const DiscoverScreen = ({ activeTab, onTabPress, onMembershipPress, onMessagesPress, onOpenChat, openPostModal, onPostModalOpened, startOnMyActivity, postPrefill, onPostPrefillConsumed, onSafetyPress }: DiscoverScreenProps) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const emailPrefix = user?.email?.split("@")[0] ?? "";
  const fullName = user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.user_metadata?.first_name
    || user?.user_metadata?.display_name
    || "";
  const firstName = fullName
    ? fullName.split(" ")[0].toLowerCase()
    : emailPrefix.toLowerCase() || "there";
  const [discoverMode, setDiscoverMode] = useState<"browse" | "myActivity">("browse");
  const [myActivityTab, setMyActivityTab] = useState<"posts" | "saved">("posts");
  const [savedActivities, setSavedActivities] = useState<any[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const walkthroughShownRef = useRef(false);
  const [toggleY, setToggleY] = useState(120);
  const hasUnread = false;
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());

  // Sunny dynamic copy
  const [sunnyDeckDoneDesc, setSunnyDeckDoneDesc] = useState("check back tomorrow or post your own.");
  useEffect(() => {
    getSunnyResponse({ context: "emptyDiscover" }).then(setSunnyDeckDoneDesc);
  }, []);

  useEffect(() => {
    if (walkthroughShownRef.current) return;
    (async () => {
      const walkthroughRaw = await AsyncStorage.getItem("walkthrough_complete");
      const currentUserId = (await supabase.auth.getUser()).data.user?.id;

      let walkthroughSeen = false;
      if (walkthroughRaw) {
        try {
          const parsed = JSON.parse(walkthroughRaw);
          walkthroughSeen = parsed.userId === currentUserId && parsed.seen === true;
        } catch {
          walkthroughSeen = false;
        }
      }

      if (!walkthroughSeen) {
        walkthroughShownRef.current = true;
        setShowWalkthrough(true);
      }
    })();
  }, [user]);

  const { tier, isLimited, incrementImIn } = useMembershipTier();

  const [requestedSet, setRequestedSet] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showUpsell, setShowUpsell] = useState(false);
  const [showRequestSheet, setShowRequestSheet] = useState(false);
  const [requestSheetActivity, setRequestSheetActivity] = useState<any | null>(null);
  const [myPostsState, setMyPostsState] = useState<any[]>([]);
  const [showViewerProfile, setShowViewerProfile] = useState(false);
  const [viewerProfileData, setViewerProfileData] = useState<{ id: string; name: string; photo: string } | null>(null);
  const [viewerProfileFetched, setViewerProfileFetched] = useState<any | null>(null);
  const [viewerProfileLoading, setViewerProfileLoading] = useState(false);
  const [safetyCheckInActivity, setSafetyCheckInActivity] = useState<any | null>(null);
  const [showFirstJoinReminder, setShowFirstJoinReminder] = useState(false);
  const [pendingNudgePlace, setPendingNudgePlace] = useState<any | null>(null);
  const [showLocationNudge, setShowLocationNudge] = useState(false);

  // Fetch full profile when viewer modal opens
  useEffect(() => {
    if (!showViewerProfile || !viewerProfileData?.id) return;
    setViewerProfileLoading(true);
    setViewerProfileFetched(null);
    const userId = viewerProfileData.id;
    Promise.all([
      supabase
        .from("profiles")
        .select("user_id, first_name, avatar_url, occupation, birthday, personality_type, humor_type, usage_reasons, quick_prompts, deep_prompts, location_name, photos, membership_tier")
        .eq("user_id", userId)
        .maybeSingle(),
      user
        ? supabase
            .from("profiles")
            .select("humor_type, usage_reasons, personality_type, quick_prompts")
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]).then(([viewerResult, ownResult]) => {
      setViewerProfileFetched(viewerResult.data ?? null);
      setOwnProfile((ownResult as any).data ?? null);
      setViewerProfileLoading(false);
    });
  }, [showViewerProfile, viewerProfileData?.id]);

  // Live activity data
  const [liveActivities, setLiveActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [loadingMyPosts, setLoadingMyPosts] = useState(false);

  const [fontsLoaded] = useFonts({ Caveat_400Regular });
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  };

  const [saveToastVisible, setSaveToastVisible] = useState(false);
  const saveToastOpacity = useRef(new Animated.Value(0)).current;
  const triggerSaveToast = () => {
    setSaveToastVisible(true);
    saveToastOpacity.setValue(0);
    Animated.timing(saveToastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(saveToastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setSaveToastVisible(false));
    }, 2500);
  };
  const [showPostModal, setShowPostModal] = useState(false);
  useEffect(() => {
    if (openPostModal) { setShowPostModal(true); onPostModalOpened?.(); }
  }, [openPostModal]);
  useEffect(() => {
    if (!postPrefill) return;
    setPostLocation(postPrefill.name);
    setPostLocationLat(postPrefill.lat);
    setPostLocationLng(postPrefill.lng);
    onPostPrefillConsumed?.();
  }, [postPrefill]);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showFilterUpsell, setShowFilterUpsell] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Filter state
  const [filterDistance, setFilterDistance] = useState("10 mi");
  const [filterAgeMin, setFilterAgeMin] = useState(18);
  const [filterAgeMax, setFilterAgeMax] = useState(35);
  const [filterGenders, setFilterGenders] = useState<string[]>(["all"]);
  const [filterSexuality, setFilterSexuality] = useState<string[]>([]);
  const [filterReligion, setFilterReligion] = useState<string[]>([]);
  const [filterPersonality, setFilterPersonality] = useState<string[]>([]);
  const [filterHumor, setFilterHumor] = useState<string[]>([]);

  const toggleMulti = (list: string[], val: string, setList: (v: string[]) => void) => {
    if (val === "all") { setList(["all"]); return; }
    const next = list.filter(x => x !== "all");
    setList(next.includes(val) ? next.filter(x => x !== val) : [...next, val]);
  };

  const hasLockedFilter = filterSexuality.length > 0 || filterReligion.length > 0 ||
    filterPersonality.length > 0 || filterHumor.length > 0;

  const resetFilters = () => {
    setFilterDistance("10 mi");
    setFilterAgeMin(18);
    setFilterAgeMax(35);
    setFilterGenders(["all"]);
    setSelectedCategory(null);
    setFilterSexuality([]);
    setFilterReligion([]);
    setFilterPersonality([]);
    setFilterHumor([]);
  };
  const [postSpots, setPostSpots] = useState(1);
  const [showGroupUpsell, setShowGroupUpsell] = useState(false);
  const [showGroupNudge, setShowGroupNudge] = useState(false);
  const maxCompanions = tier === "free" ? 1 : 10;
  const [postTitle, setPostTitle] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [postSelectedCategory, setPostSelectedCategory] = useState("");
  const [postCustomCategory, setPostCustomCategory] = useState("");
  const [postLocation, setPostLocation] = useState("");
  const [postLocationLat, setPostLocationLat] = useState<number | null>(null);
  const [postLocationLng, setPostLocationLng] = useState<number | null>(null);
  const [postDesc, setPostDesc] = useState("");
  const [postPhotoUri, setPostPhotoUri] = useState<string | null>(null);
  const [postPhotoUploading, setPostPhotoUploading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  const handlePickPostPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    setPostPhotoUri(asset.uri);
  };
  const [showHostProfile, setShowHostProfile] = useState(false);
  const [hostProfileFetched, setHostProfileFetched] = useState<any | null>(null);
  const [hostProfileLoading, setHostProfileLoading] = useState(false);
  const [ownProfile, setOwnProfile] = useState<any | null>(null);
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());

  // Fetch full host profile + own profile when modal opens
  useEffect(() => {
    if (!showHostProfile || !profileActivity?.host?.user_id) return;
    const userId = profileActivity.host.user_id;
    setHostProfileLoading(true);
    setHostProfileFetched(null);
    Promise.all([
      supabase
        .from("profiles")
        .select("user_id, first_name, avatar_url, occupation, birthday, personality_type, humor_type, usage_reasons, quick_prompts, deep_prompts")
        .eq("user_id", userId)
        .maybeSingle(),
      user ? supabase
        .from("profiles")
        .select("humor_type, usage_reasons, personality_type, quick_prompts")
        .eq("user_id", user.id)
        .maybeSingle() : Promise.resolve({ data: null }),
    ]).then(([hostResult, ownResult]) => {
      setHostProfileFetched(hostResult.data ?? null);
      setOwnProfile((ownResult as any).data ?? null);
      setHostProfileLoading(false);
    });
  }, [showHostProfile, profileActivity?.host?.user_id]);

  useEffect(() => {
    AsyncStorage.getItem("saved_activities").then(val => {
      if (val) setSavedSet(new Set(JSON.parse(val)));
    });
  }, []);

  const saveActivity = (id: string) => {
    setSavedSet(prev => {
      const next = new Set(prev);
      next.add(id);
      AsyncStorage.setItem("saved_activities", JSON.stringify([...next]));
      return next;
    });
    const activity = liveActivities.find((a: any) => a.id === id);
    if (activity) {
      AsyncStorage.getItem("saved_activities_meta").then(val => {
        const existing = val ? JSON.parse(val) : {};
        existing[id] = { title: activity.title, date: activity.activity_date ?? activity.date, host: activity.host?.name ?? "", category: activity.tags?.[0] ?? activity.category ?? "" };
        AsyncStorage.setItem("saved_activities_meta", JSON.stringify(existing));
      });
    }
  };
  const [profileActivity, setProfileActivity] = useState<any | null>(null);

  // I'm In celebration modal
  const [showCelebModal, setShowCelebModal] = useState(false);
  const [celebData, setCelebData] = useState<{ title: string; subtitle: string; onDone: () => void } | null>(null);
  const [celebTandemData, setCelebTandemData] = useState<{ id: string; name: string; photo: string } | null>(null);

  const showImInToast = (title: string, subtitle: string, onDone: () => void) => {
    setCelebData({ title, subtitle, onDone });
    setShowCelebModal(true);
  };

  const handleCelebrationDismiss = () => {
    setShowCelebModal(false);
    celebData?.onDone();
    setCelebData(null);
    setCelebTandemData(null);
  };

  // Approved counts per post for tier enforcement
  const [approvedCounts, setApprovedCounts] = useState<Record<string, number>>({});
  const getApprovalLimit = () => {
    if (tier === "trail") return Infinity;
    if (tier === "go") return 5;
    return 1; // free
  };

  // Fetch live browse activities
  //
  // DATABASE CLEANUP — run in Supabase SQL editor if ghost posts appear:
  // delete from public.activities where user_id not in (select id from auth.users);
  // delete from public.activities where user_id not in (select user_id from public.profiles);
  const fetchLiveActivities = useCallback(async (cancelled: { current: boolean }) => {
    setLoadingActivities(true);
    // Show activities from up to 7 days ago so recently-posted activities
    // don't vanish immediately when their date passes.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .eq("status", "active")
      .gte("activity_date", cutoffStr)
      .order("activity_date", { ascending: true })
      .limit(20);
    console.log("[Feed] raw results count:", data?.length ?? 0);
    console.log("[Feed] fetch error:", error ? JSON.stringify(error) : "none");
    if (cancelled.current) return;
    if (!error && data && data.length > 0) {
      // Only fetch profiles for activities that have a non-null user_id
      const userIds = [...new Set(data.map((a: any) => a.user_id).filter(Boolean))] as string[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, avatar_url")
        .in("user_id", userIds);
      const profileMap: Record<string, { first_name: string; avatar_url: string }> = {};
      for (const p of profiles ?? []) {
        profileMap[p.user_id] = p;
      }
      if (cancelled.current) return;
      // Filter out ghost activities: no user_id or no matching profile with a first_name
      const validActivities = data.filter((a: any) =>
        a.user_id && profileMap[a.user_id]?.first_name
      );
      console.log("[Feed] valid (non-ghost) count:", validActivities.length);

      // Fetch all interactions, blocked users, and own profile in parallel
      const currentUserId = (await supabase.auth.getUser()).data.user?.id;
      let excludedIds = new Set<string>();
      let blockedIds = new Set<string>();
      let ownProfile: any = null;
      if (currentUserId) {
        const [{ data: interactions }, { data: blockedData }, { data: profileData }] = await Promise.all([
          supabase
            .from("activity_interactions")
            .select("activity_id")
            .eq("user_id", currentUserId),
          supabase
            .from("blocked_users")
            .select("blocked_id")
            .eq("blocker_id", currentUserId),
          supabase
            .from("profiles")
            .select("location_lat, location_lng, filter_preferences")
            .eq("user_id", currentUserId)
            .maybeSingle(),
        ]);
        excludedIds = new Set((interactions ?? []).map((i: any) => i.activity_id));
        blockedIds = new Set((blockedData ?? []).map((b: any) => b.blocked_id));
        ownProfile = profileData;
        setBlockedUserIds(blockedIds);
      }
      if (cancelled.current) return;

      const userLat: number | null = ownProfile?.location_lat ?? null;
      const userLng: number | null = ownProfile?.location_lng ?? null;
      const distancePref: number = ownProfile?.filter_preferences?.distance ?? 25;

      // Log own posts being excluded
      console.log("[Feed] own post ids excluded:", validActivities
        .filter((a: any) => a.user_id === currentUserId)
        .map((a: any) => a.title));

      // Exclude interacted activities, own posts, and blocked users
      const baseFiltered = validActivities.filter((a: any) =>
        !excludedIds.has(a.id) && a.user_id !== currentUserId && !blockedIds.has(a.user_id)
      );

      // Time filter: exclude past activities; for today, exclude if time has passed
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const currentTime = now.toTimeString().split(" ")[0];
      const afterTime = baseFiltered.filter((a: any) => {
        if (!a.activity_date) return true;
        if (a.activity_date > today) return true;
        if (a.activity_date < today) return false;
        // today: only include if no time set or time is in the future
        return !a.activity_time || a.activity_time > currentTime;
      });

      // Distance filter + attach computed distance
      const withDistance = afterTime.map((a: any) => {
        let distanceMiles: number | null = null;
        if (userLat != null && userLng != null && a.location_lat != null && a.location_lng != null) {
          distanceMiles = calcDistanceMiles(userLat, userLng, a.location_lat, a.location_lng);
        }
        return { ...a, _distanceMiles: distanceMiles };
      });
      const afterDistance = withDistance.filter((a: any) => {
        if (userLat == null || userLng == null) return true;
        if (a._distanceMiles == null) return true;
        return a._distanceMiles <= distancePref;
      });

      console.log("[Feed] filtered by distance/time:", {
        total: baseFiltered.length,
        afterTimeFilter: afterTime.length,
        afterDistanceFilter: afterDistance.length,
        userLat, userLng, distancePref,
      });

      // Sort: blend of soon-ness and proximity
      const nowMs = Date.now();
      afterDistance.sort((a: any, b: any) => {
        const aDate = new Date(`${a.activity_date}T${a.activity_time || "23:59:59"}`);
        const bDate = new Date(`${b.activity_date}T${b.activity_time || "23:59:59"}`);
        const aHours = Math.max(0, (aDate.getTime() - nowMs) / (60 * 60 * 1000));
        const bHours = Math.max(0, (bDate.getTime() - nowMs) / (60 * 60 * 1000));
        const aScore = aHours + (a._distanceMiles ?? 0) * 0.5;
        const bScore = bHours + (b._distanceMiles ?? 0) * 0.5;
        return aScore - bScore;
      });

      setLiveActivities(afterDistance.map((a: any) => ({
        id: a.id,
        title: a.title,
        category: a.tags?.[0] ?? "default",
        photo: FALLBACK_PHOTOS[a.tags?.[0]] ?? FALLBACK_PHOTOS.default,
        image_url: a.image_url ?? null,
        distance: a._distanceMiles != null ? `${a._distanceMiles.toFixed(1)} mi` : "",
        location: a.location_name ?? "",
        date: a.activity_date ?? "",
        time: a.activity_time ?? "",
        tags: a.tags ?? [],
        vibeEmojis: [],
        goingCount: 0,
        goingAvatars: [],
        vibe: a.description ?? "",
        host: {
          name: profileMap[a.user_id].first_name,
          user_id: a.user_id,
          photo: profileMap[a.user_id].avatar_url ?? "",
          rating: 0,
          bio: "",
          activitiesCount: 0,
          companionsCount: 0,
          sharedInterests: [],
          promptAnswers: [],
          previousActivities: [],
        },
      })));
    } else {
      setLiveActivities([]);
    }
    setLoadingActivities(false);
  }, []);

  useEffect(() => {
    if (discoverMode !== "browse") return;
    const cancelled = { current: false };
    fetchLiveActivities(cancelled);

    // Realtime: reload feed when any activity is inserted
    const channel = supabase
      .channel("activities-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activities" },
        () => { if (!cancelled.current) fetchLiveActivities(cancelled); }
      )
      .subscribe();

    return () => {
      cancelled.current = true;
      supabase.removeChannel(channel);
    };
  }, [discoverMode, feedRefreshKey, fetchLiveActivities]);

  // Fetch my posts when switching to myActivity tab
  useEffect(() => {
    if (discoverMode !== "myActivity" || !user) return;
    let cancelled = false;
    setLoadingMyPosts(true);
    supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(async ({ data, error }) => {
        if (cancelled || error || !data) { setLoadingMyPosts(false); return; }
        const mapped = await Promise.all(data.map(async (a: any) => {
          const { data: requests } = await supabase
            .from("activity_interactions")
            .select("*, profiles!user_id(first_name, avatar_url)")
            .eq("activity_id", a.id)
            .eq("action", "join_request");

          // Fetch who tapped "i'm in" from join_requests
          const { data: joinReqs } = await supabase
            .from("join_requests")
            .select("requester_id")
            .eq("activity_id", a.id)
            .eq("status", "pending");
          const requesterIds = [...new Set((joinReqs ?? []).map((r: any) => r.requester_id).filter(Boolean))] as string[];
          let interestedMap: Record<string, { first_name: string; avatar_url: string }> = {};
          if (requesterIds.length > 0) {
            const { data: profs } = await supabase
              .from("profiles")
              .select("user_id, first_name, avatar_url")
              .in("user_id", requesterIds);
            for (const p of profs ?? []) interestedMap[p.user_id] = p;
          }

          return {
            id: a.id,
            title: a.title,
            photo: FALLBACK_PHOTOS[a.tags?.[0]] ?? FALLBACK_PHOTOS.default,
            date: a.activity_date ?? "",
            pendingRequests: (requests ?? []).map((r: any) => ({
              id: r.user_id,
              name: r.profiles?.first_name ?? "someone",
              photo: r.profiles?.avatar_url ?? "",
              bio: "",
            })),
            interestedUsers: requesterIds.map(id => ({
              id,
              name: interestedMap[id]?.first_name ?? "someone",
              photo: interestedMap[id]?.avatar_url ?? "",
            })),
          };
        }));
        if (!cancelled) {
          setMyPosts(mapped);
          setMyPostsState(mapped);
        }
        setLoadingMyPosts(false);
      });
    return () => { cancelled = true; };
  }, [discoverMode, user]);

  useEffect(() => {
    if (startOnMyActivity) {
      setDiscoverMode("myActivity");
    }
  }, [startOnMyActivity]);

  useEffect(() => {
    if (myActivityTab !== "saved" || discoverMode !== "myActivity") return;
    // Load from AsyncStorage first (instant), then hydrate from Supabase
    AsyncStorage.getItem("saved_activities_meta").then(val => {
      if (val) {
        const meta = JSON.parse(val);
        const list = Object.entries(meta).map(([id, data]: any) => ({ id, ...data }));
        setSavedActivities(list);
      }
    });
    fetchSaved();
  }, [myActivityTab, discoverMode]);

  // Reset deck index when filter or mode changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [activeFilter, discoverMode]);

  const deck = (() => {
    return activeFilter === "all" ? liveActivities : liveActivities.filter((a: any) => a.category === activeFilter);
  })();

  const handleImIn = (activityId: string) => {
    if (isLimited) {
      setShowUpsell(true);
      return;
    }
    const act = liveActivities.find((a: any) => a.id === activityId);
    if (!act) return;
    setSafetyCheckInActivity(act);
  };

  const executeImIn = async (activityId: string) => {
    const act = liveActivities.find((a: any) => a.id === activityId);

    // Show celebration immediately — before any async work
    showImInToast("you're in!", "your request is on its way.", () => {});
    setRequestedSet(prev => new Set([...prev, activityId]));
    setCurrentIndex(prev => prev + 1);

    // Async: insert join request
    // SUPABASE: Ensure join_requests table exists:
    // CREATE TABLE IF NOT EXISTS join_requests (
    //   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    //   activity_id uuid REFERENCES activities(id) ON DELETE CASCADE,
    //   requester_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    //   status text DEFAULT 'pending',
    //   created_at timestamptz DEFAULT now()
    // );
    if (user) {
      const { error } = await supabase.from("join_requests").insert({
        activity_id: activityId,
        requester_id: user.id,
        status: "pending",
      } as any);
      if (error) {
        console.warn("join_requests insert failed:", error.message);
      }

      // auto-create tandem so both users can chat immediately
      if (act?.host?.user_id) {
        await supabase.from("tandems").upsert(
          {
            activity_id: activityId,
            user_a_id: user.id,
            user_b_id: act.host.user_id,
          },
          { onConflict: "user_a_id,user_b_id,activity_id", ignoreDuplicates: true }
        );
        // Fetch the tandem ID so the celebration modal can open the chat directly
        const { data: tandemRow } = await supabase
          .from("tandems")
          .select("id")
          .eq("activity_id", activityId)
          .eq("user_a_id", user.id)
          .maybeSingle();
        if (tandemRow?.id) {
          setCelebTandemData({
            id: tandemRow.id,
            name: act.host.name ?? "them",
            photo: act.host.photo ?? "",
          });
        }
      }
    }

    await incrementImIn();

    const seen = await hasSeenFirstJoinReminder();
    if (!seen) {
      await markFirstJoinReminderSeen();
      setShowFirstJoinReminder(true);
    }
  };

  const handleBlockReport = () => {
    if (!currentCard || !user) return;
    const hostUserId = currentCard.host.user_id;
    const activityId = currentCard.id;
    Alert.alert(
      "",
      "what would you like to do?",
      [
        {
          text: "block user",
          style: "destructive",
          onPress: async () => {
            await supabase.from("blocked_users").upsert(
              { blocker_id: user.id, blocked_id: hostUserId },
              { ignoreDuplicates: true }
            );
            setBlockedUserIds(prev => new Set([...prev, hostUserId]));
            setLiveActivities(prev => prev.filter((a: any) => a.user_id !== hostUserId));
            showToast("user blocked.");
          },
        },
        {
          text: "report",
          onPress: async () => {
            await supabase.from("user_reports").insert({
              reporter_id: user.id,
              reported_user_id: hostUserId,
              activity_id: activityId,
              reason: "reported from feed",
            });
            showToast("report submitted.");
          },
        },
        { text: "cancel", style: "cancel" },
      ]
    );
  };

  const handleSkip = async () => {
    if (currentCard && user) {
      try {
        await supabase.from("activity_interactions").upsert(
          { activity_id: currentCard.id, user_id: user.id, action: "decline" },
          { ignoreDuplicates: true }
        );
      } catch (err: any) {
        logError(err, { screen: "DiscoverScreen", action: "handleSkip" });
      }
    }
    setCurrentIndex(prev => prev + 1);
  };

  const handleMaybeLater = async () => {
    if (!currentCard) return;
    try {
      if (user) {
        await supabase.from("activity_interactions").upsert(
          { activity_id: currentCard.id, user_id: user.id, action: "save" },
          { ignoreDuplicates: true }
        );
      }
    } catch (err: any) {
      logError(err, { screen: "DiscoverScreen", action: "handleMaybeLater_upsert" });
    }
    // Also persist to AsyncStorage so the Saved tab can load without a Supabase round-trip
    try {
      const existing = await AsyncStorage.getItem("saved_activities_meta");
      const meta = existing ? JSON.parse(existing) : {};
      meta[currentCard.id] = {
        title: currentCard.title,
        date: currentCard.date,
        host: currentCard.host?.name ?? "",
        category: currentCard.category,
        photo: currentCard.photo,
        location: currentCard.location,
      };
      await AsyncStorage.setItem("saved_activities_meta", JSON.stringify(meta));
    } catch (err: any) {
      logError(err, { screen: "DiscoverScreen", action: "handleMaybeLater_storage" });
    }
    showToast("saved to your private list.");
    setCurrentIndex(prev => prev + 1);
    setTimeout(() => { setDiscoverMode("myActivity"); setMyActivityTab("saved"); }, 800);
  };

  const fetchSaved = async () => {
    if (!user) return;
    setLoadingSaved(true);
    try {
      const { data } = await supabase
        .from("activity_interactions")
        .select("activity_id, activities(id, title, activity_date, tags, location_name)")
        .eq("user_id", user.id)
        .eq("action", "save")
        .order("created_at", { ascending: false });

      if (data) {
        setSavedActivities(
          data
            .filter((d: any) => d.activities)
            .map((d: any) => ({
              id: d.activities.id,
              title: d.activities.title,
              date: d.activities.activity_date,
              location: d.activities.location_name,
              photo: FALLBACK_PHOTOS[d.activities.tags?.[0]] || FALLBACK_PHOTOS.default,
            }))
        );
      }
    } catch (err: any) {
      logError(err, { screen: "DiscoverScreen", action: "fetchSaved" });
    } finally {
      setLoadingSaved(false);
    }
  };

  // My Activity — request sheet handlers
  const handleLetIn = (postId: string, requesterId: string, _requesterName: string, activityTitle: string) => {
    const limit = getApprovalLimit();
    const current = approvedCounts[postId] ?? 0;
    if (current >= limit) return; // already at limit, button should be disabled
    setApprovedCounts(prev => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }));
    setMyPostsState(prev => prev.map(p => {
      if (p.id !== postId) return p;
      return { ...p, pendingRequests: p.pendingRequests.filter(r => r.id !== requesterId) };
    }));
    if (requestSheetActivity?.id === postId) {
      setRequestSheetActivity(prev => prev ? {
        ...prev,
        pendingRequests: prev.pendingRequests.filter(r => r.id !== requesterId),
      } : null);
    }
    // Persist acceptance to DB
    supabase
      .from("join_requests")
      .update({ status: "accepted" })
      .eq("activity_id", postId)
      .eq("requester_id", requesterId)
      .then(({ error }) => {
        if (error) console.warn("[handleLetIn] failed to update join_requests:", error.message);
      });
    showToast(`you're in. get ready for ${activityTitle}.`);
  };

  const handlePass = (postId: string, requesterId: string) => {
    setMyPostsState(prev => prev.map(p => {
      if (p.id !== postId) return p;
      return { ...p, pendingRequests: p.pendingRequests.filter(r => r.id !== requesterId) };
    }));
    if (requestSheetActivity?.id === postId) {
      setRequestSheetActivity(prev => prev ? {
        ...prev,
        pendingRequests: prev.pendingRequests.filter(r => r.id !== requesterId),
      } : null);
    }
    showToast("not this time. there's more out there.");
  };

  const formatDateForDB = (date: Date | string): string => {
    // Strip ordinal suffixes (1st, 2nd, 3rd...) if string, then convert to Date
    const d = date instanceof Date
      ? date
      : new Date((date as string).trim().replace(/(\d+)(st|nd|rd|th)/gi, "$1"));
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleSubmitPost = async () => {
    if (!postTitle.trim()) {
      showToast("add a title to post.");
      return;
    }
    const finalCategory = postSelectedCategory === "other"
      ? postCustomCategory.trim()
      : postSelectedCategory;
    const formattedDate = formatDateForDB(selectedDate);
    // -- Run in Supabase SQL editor if not already done:
    // alter table public.activities add column if not exists image_url text;
    setIsPosting(true);
    let uploadedImageUrl: string | null = null;
    try {
      // Always use a fresh auth user to avoid stale context state causing FK violations
      const { data: { user: freshUser } } = await supabase.auth.getUser();
      if (!freshUser) {
        showToast("sign in again to post.");
        setIsPosting(false);
        return;
      }

      // Rate limit: max 5 posts per 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("user_id", freshUser.id)
        .gte("created_at", twentyFourHoursAgo);
      if (count !== null && count >= 5) {
        showToast("you've hit today's post limit. try again tomorrow.");
        setIsPosting(false);
        return;
      }

      // Upload photo first if one was selected
      if (postPhotoUri) {
        setPostPhotoUploading(true);
        const fileExt = postPhotoUri.split(".").pop()?.toLowerCase() || "jpg";
        const mimeType = fileExt === "png" ? "image/png" : "image/jpeg";
        const fileName = `activity_${Date.now()}.${fileExt}`;
        const storagePath = `${freshUser.id}/${fileName}`;
        const formData = new FormData();
        formData.append("file", { uri: postPhotoUri, name: fileName, type: mimeType } as any);
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(storagePath, formData, { contentType: mimeType, upsert: true, cacheControl: "0" });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(storagePath);
          uploadedImageUrl = urlData?.publicUrl ?? null;
        }
        setPostPhotoUploading(false);
      }

      const payload = {
        user_id: freshUser.id,
        title: postTitle.trim(),
        description: postDesc.trim() || null,
        activity_date: formattedDate,
        activity_time: selectedTime
          ? selectedTime.toTimeString().split(" ")[0]
          : null,
        location_name: postLocation.trim() || null,
        location_lat: postLocationLat,
        location_lng: postLocationLng,
        tags: finalCategory ? [finalCategory] : [],
        max_participants: postSpots,
        is_group: postSpots > 1,
        status: "active",
        image_url: uploadedImageUrl,
      };
      console.log("[Post] submitting:", payload);
      const { data, error } = await supabase.from("activities").insert(payload).select().single();
      console.log("[Post] result:", error);
      if (error) {
        Alert.alert("couldn't create post", error.message);
        return;
      }
      console.log("[Post] created:", data);
      setShowPostModal(false);
      setPostTitle("");
      setSelectedDate(new Date());
      setSelectedTime(null);
      setPostSelectedCategory("");
      setPostCustomCategory("");
      setPostLocation("");
      setPostLocationLat(null);
      setPostLocationLng(null);
      setPostDesc("");
      setPostSpots(1);
      setPostPhotoUri(null);
      setShowGroupNudge(false);
      setFeedRefreshKey(k => k + 1);
      showToast("posted! check back soon.");
    } catch (err: any) {
      console.error("[Post] exception:", err);
      logError(err, { screen: "DiscoverScreen", action: "handleSubmitPost" });
      Alert.alert("couldn't create post", "something went wrong. try again?");
    } finally {
      setIsPosting(false);
      setPostPhotoUploading(false);
    }
  };

  const currentCard = deck[currentIndex];
  const isDone = currentIndex >= deck.length;
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "good morning" : hour < 17 ? "good afternoon" : "good evening";
  const cardImageUrl: string | null = currentCard?.image_url ?? null;
  const cardGradient = currentCard ? getCardGradient(currentCard.category) : CATEGORY_GRADIENT.default;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <View style={s.headerLeft}>
          <Text style={s.greeting}>{timeGreeting}, {firstName}</Text>
          <Text style={s.headerTitle}>discover</Text>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.iconBtn} onPress={() => setShowFilterSheet(true)} activeOpacity={0.7}>
            <Ionicons name="options-outline" size={22} color={colors.teal} />
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={() => setShowNotifications(true)} activeOpacity={0.7}>
            <Ionicons name={hasUnread ? "notifications" : "notifications-outline"} size={22} color={colors.teal} />
            {hasUnread && <View style={s.iconBadge} />}
          </TouchableOpacity>
          <TouchableOpacity style={s.avatarBtn} onPress={() => onTabPress("Profile")} activeOpacity={0.85}>
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatarRing}>
              <View style={s.avatarInner}>
                <Ionicons name="person" size={16} color={colors.teal} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Browse / My Activity toggle */}
      <View style={s.modeToggleRow} onLayout={e => setToggleY(e.nativeEvent.layout.y)}>
        <View style={s.modeToggle}>
          {(["browse", "myActivity"] as const).map(mode => (
            <TouchableOpacity key={mode} onPress={() => setDiscoverMode(mode)} activeOpacity={0.8} style={s.modeToggleBtn}>
              {discoverMode === mode ? (
                <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.modeActive}>
                  <Text style={s.modeActiveText}>{mode === "browse" ? "browse" : "my activity"}</Text>
                </LinearGradient>
              ) : (
                <View style={s.modeInactive}>
                  <Text style={s.modeInactiveText}>{mode === "browse" ? "browse" : "my activity"}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* My Activity hint */}
      {discoverMode === "myActivity" && (
        <Text style={s.myActivityHint}>your posts, requests, and saved activities</Text>
      )}

      {/* Sub-tab: my posts / saved (only in My Activity) */}
      {discoverMode === "myActivity" && (
        <>
          <View style={s.subTabRow}>
            {(["posts", "saved"] as const).map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => setMyActivityTab(t)}
                activeOpacity={0.8}
                style={[s.subTab, myActivityTab === t && s.subTabActive]}
              >
                <Text style={[s.subTabText, myActivityTab === t && s.subTabTextActive]}>
                  {t === "posts" ? "my posts" : "saved"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {myActivityTab === "saved" && (
            <Text style={{ fontSize: 11, fontFamily: "Quicksand_400Regular", color: colors.muted, paddingHorizontal: 16, paddingBottom: 4 }}>
              only visible to you
            </Text>
          )}
        </>
      )}

      {/* Filter pills */}
      {discoverMode === "browse" && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.filtersScroll}
          contentContainerStyle={s.filtersContent}
        >
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setActiveFilter(f.key)}
              activeOpacity={0.8}
            >
              {activeFilter === f.key ? (
                <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.filterPillActive}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    {f.icon ? <Ionicons name={f.icon as any} size={13} color={colors.white} /> : null}
                    <Text style={s.filterTextActive}>{f.label}</Text>
                  </View>
                </LinearGradient>
              ) : (
                <View style={s.filterPill}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    {f.icon ? <Ionicons name={f.icon as any} size={13} color={colors.teal} /> : null}
                    <Text style={s.filterText}>{f.label}</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Main content area */}
      {discoverMode === "myActivity" ? (
        /* ── My Activity Tab ── */
        myActivityTab === "posts" ? (
          loadingMyPosts ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={colors.teal} size="large" />
            </View>
          ) : (
            <ScrollView
              style={s.feed}
              contentContainerStyle={[s.feedContent, { paddingBottom: 100 + insets.bottom }]}
              showsVerticalScrollIndicator={false}
            >
              {myPostsState.length === 0 ? (
                <View style={s.myActivityEmpty}>
                  <SunnyAvatar expression="warm" size={60} />
                  <Text style={s.myActivityEmptyTitle}>nothing on the calendar yet.</Text>
                  <Text style={s.myActivityEmptyDesc}>post something or hit i'm in. sunny's waiting.</Text>
                </View>
              ) : (
                myPostsState.map(post => (
                  <TouchableOpacity
                    key={post.id}
                    style={s.myPostRow}
                    activeOpacity={0.85}
                    onPress={() => {
                      setRequestSheetActivity(post);
                      setShowRequestSheet(true);
                    }}
                  >
                    <Image source={{ uri: post.photo }} style={s.myPostPhoto} resizeMode="cover" />
                    <View style={s.myPostInfo}>
                      <Text style={s.myPostTitle} numberOfLines={2}>{post.title}</Text>
                      <Text style={s.myPostDate}>{post.date}</Text>
                    </View>
                    {post.pendingRequests.length > 0 && (
                      <View style={[s.requestBadge, { backgroundColor: colors.teal }]}>
                        <Text style={[s.requestBadgeText, { color: colors.white }]}>
                          {post.pendingRequests.length} waiting
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )
        ) : (
          /* ── Saved Tab ── */
          <ScrollView
            style={s.feed}
            contentContainerStyle={[s.feedContent, { paddingBottom: 100 + insets.bottom }]}
            showsVerticalScrollIndicator={false}
          >
            {loadingSaved ? (
              <ActivityIndicator color={colors.teal} style={{ marginTop: 40 }} />
            ) : savedActivities.length === 0 ? (
              <View style={s.myActivityEmpty}>
                <SunnyAvatar expression="warm" size={60} />
                <Text style={s.myActivityEmptyTitle}>nothing saved yet.</Text>
                <Text style={s.myActivityEmptyDesc}>
                  tap "maybe later" on any activity to save it here. only you can see this.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {savedActivities.map((act: any) => (
                  <TouchableOpacity
                    key={act.id}
                    activeOpacity={0.85}
                    onPress={() => {
                      const idx = liveActivities.findIndex((a: any) => a.id === act.id);
                      if (idx !== -1) {
                        setDiscoverMode("browse");
                        setCurrentIndex(idx);
                      } else {
                        showToast("this activity may no longer be available.");
                      }
                    }}
                    style={s.myPostRow}
                  >
                    <Image source={{ uri: act.photo }} style={s.myPostPhoto} resizeMode="cover" />
                    <View style={s.myPostInfo}>
                      <Text style={s.myPostTitle} numberOfLines={2}>{act.title}</Text>
                      <Text style={s.myPostDate}>{act.date} · {act.location}</Text>
                    </View>
                    <View style={s.requestBadge}>
                      <Text style={s.requestBadgeText}>saved</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        )
      ) : (
        /* ── Browse Tab — Card Deck ── */
        <View style={s.deckContainer}>
          {loadingActivities ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={colors.teal} size="large" />
            </View>
          ) : null}
          {/* Locked filter indicator */}
          {!loadingActivities && hasLockedFilter && (
            <View style={s.lockedFilterPill}>
              <Ionicons name="lock-closed-outline" size={11} color={colors.teal} />
              <Text style={s.lockedFilterText}>filtered (tandem go)</Text>
            </View>
          )}
          {/* Progress indicator */}
          {!loadingActivities && !isDone && deck.length > 0 && (
            <Text style={s.deckProgress}>{currentIndex + 1} of {deck.length} nearby</Text>
          )}

          {!loadingActivities && (isDone || deck.length === 0) ? (
            <View style={s.deckDone}>
              <SunnyAvatar expression="warm" size={64} />
              <Text style={s.deckDoneTitle}>that's everyone nearby for now.</Text>
              <Text style={s.deckDoneDesc}>{sunnyDeckDoneDesc}</Text>
            </View>
          ) : !currentCard ? null : (
            <>
              {/* Card scrollable area */}
              <ScrollView
                style={s.cardScroll}
                contentContainerStyle={s.cardScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={s.cardWrapper}>
                  {/* White card */}
                  <View style={[s.card, savedSet.has(currentCard.id) && s.cardSaved]}>
                    {/* Saved indicator pill */}
                    {savedSet.has(currentCard.id) && (
                      <View style={s.savedPill}>
                        <Ionicons name="bookmark" size={11} color={colors.teal} />
                        <Text style={s.savedPillText}>saved for later</Text>
                      </View>
                    )}
                    {/* Full-bleed photo/gradient with category pill overlay */}
                    <View style={s.photoWrap}>
                      {cardImageUrl ? (
                        <Image source={{ uri: cardImageUrl }} style={s.cardPhoto} resizeMode="cover" />
                      ) : (
                        <LinearGradient
                          colors={cardGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={s.cardPhoto}
                        />
                      )}
                      {/* Category pill — bottom-left frosted overlay */}
                      <View style={s.categoryPill}>
                        <Ionicons
                          name={(CATEGORY_ICON[currentCard.category] || CATEGORY_ICON.default) as any}
                          size={12}
                          color={colors.foreground}
                        />
                        <Text style={s.categoryPillText}>{currentCard.category}</Text>
                      </View>
                      {/* Bookmark icon — top-right */}
                      <TouchableOpacity
                        style={s.bookmarkBtn}
                        activeOpacity={0.8}
                        onPress={() => { saveActivity(currentCard.id); triggerSaveToast(); }}
                      >
                        <Ionicons
                          name={savedSet.has(currentCard.id) ? "bookmark" : "bookmark-outline"}
                          size={20}
                          color={colors.teal}
                        />
                      </TouchableOpacity>
                      {/* Trail featured badge — top-right */}
                      {tier === "trail" && (
                        <LinearGradient
                          colors={gradients.brand}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={s.featuredBadge}
                        >
                          <Text style={s.featuredBadgeText}>featured</Text>
                        </LinearGradient>
                      )}
                    </View>

                    {/* Body */}
                    <View style={s.cardBody}>
                      <Text style={s.cardTitle} numberOfLines={2}>{currentCard.title}</Text>

                      <View style={s.cardMeta}>
                        <Ionicons name="location-outline" size={14} color={colors.teal} />
                        <Text style={s.cardMetaTeal}>{currentCard.location} · {currentCard.distance}</Text>
                      </View>

                      <View style={[s.cardMeta, { marginTop: 6 }]}>
                        <Ionicons name="calendar-outline" size={14} color={colors.muted} />
                        <Text style={s.cardMetaGray}>{currentCard.date} · {currentCard.time}</Text>
                      </View>

                      {/* Vibe emoji tags */}
                      {currentCard.vibeEmojis && currentCard.vibeEmojis.length > 0 && (
                        <View style={[s.vibeTagsRow, { marginTop: 12 }]}>
                          {currentCard.vibeEmojis.map((tag: string, i: number) => (
                            <View key={i} style={s.vibeTagPill}>
                              <Text style={s.vibeTagText}>{tag}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {currentCard.vibe ? (
                        <View style={[s.vibeBox, { marginTop: 10 }]}>
                          <Text style={s.vibeText}>"{currentCard.vibe}"</Text>
                        </View>
                      ) : null}

                      {/* Prompt answer cards */}
                      {currentCard.host.promptAnswers && currentCard.host.promptAnswers.map((p: any, i: number) => (
                        <View key={i} style={[s.promptCard, { marginTop: i === 0 ? 12 : 8 }]}>
                          <Text style={s.promptCardQ}>{p.question.toUpperCase()}</Text>
                          <Text style={s.promptCardA}>{p.answer}</Text>
                        </View>
                      ))}

                      {/* Attendee request row */}
                      <View style={[s.goingRow, { marginTop: 16 }]}>
                        <View style={s.avatarStack}>
                          {currentCard.goingAvatars.slice(0, 3).map((uri: string, i: number) => (
                            <Image
                              key={i}
                              source={{ uri }}
                              style={[s.stackAvatar, { marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i }]}
                            />
                          ))}
                        </View>
                        <Text style={s.goingText}>{currentCard.goingCount} wants to tandem</Text>
                      </View>
                    </View>
                  </View>

                  {/* Host strip — below card on cream bg */}
                  <View style={s.hostStrip}>
                    <View style={s.hostStripAvatarWrap}>
                      <Image source={{ uri: currentCard.host.photo }} style={s.hostStripAvatar} />
                    </View>
                    <View style={s.hostStripInfo}>
                      <Text style={s.hostStripLabel}>
                        posted by{" "}
                        <Text style={s.hostStripName}>{currentCard.host.name}</Text>
                      </Text>
                      <Text style={s.hostStripBio} numberOfLines={1}>{currentCard.host.bio}</Text>
                      {currentCard.host.user_id && user?.id && (
                        <TrustStack
                          userId={currentCard.host.user_id}
                          viewerId={user.id}
                          variant="post-card"
                        />
                      )}
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        setProfileActivity(currentCard);
                        setShowHostProfile(true);
                      }}
                    >
                      <Text style={s.viewProfile}>profile</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={handleBlockReport}
                      style={{ paddingLeft: 10 }}
                    >
                      <Ionicons name="ellipsis-horizontal" size={18} color={colors.muted} />
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>

              {/* Trust signal — above action buttons */}
              {currentCard.host.user_id && user?.id && currentCard.host.user_id !== user?.id && (
                <View style={{ paddingHorizontal: 16 }}>
                  <TrustStack
                    userId={currentCard.host.user_id}
                    viewerId={user.id}
                    variant="post-detail"
                  />
                </View>
              )}

              {/* Action buttons — pinned below card */}
              <View style={[s.actionRow, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
                {currentCard.host.user_id === user?.id ? null : requestedSet.has(currentCard.id) ? (
                  <View style={{ flex: 1 }}>
                    <View style={s.requestedBtn}>
                      <Text style={s.requestedBtnText}>requested</Text>
                    </View>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity style={{ flex: 1 }} onPress={handleSkip} activeOpacity={0.8}>
                      <View style={s.passBtn}>
                        <Text style={s.passBtnText}>pass</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ flex: 1.2 }} onPress={handleMaybeLater} activeOpacity={0.8}>
                      <View style={s.passBtn}>
                        <Text style={s.passBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>maybe later</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1.6 }}
                      onPress={() => handleImIn(currentCard.id)}
                      activeOpacity={0.88}
                    >
                      <LinearGradient
                        colors={gradients.brand}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={s.imInBtn}
                      >
                        <Text style={s.imInBtnText}>i'm in →</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </>
          )}
        </View>
      )}

      {!!toast && (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}

      {saveToastVisible && (
        <Animated.View style={[s.saveToast, { opacity: saveToastOpacity }]} pointerEvents="none">
          <Text style={[s.saveToastText, fontsLoaded ? { fontFamily: "Caveat_400Regular" } : {}]}>
            {'saved to your profile · find it under "saved"'}
          </Text>
        </Animated.View>
      )}

      <BottomNav
        activeTab={activeTab}
        onTabPress={onTabPress}
        onPostPress={() => setShowPostModal(true)}
      />

      {showWalkthrough && (
        <AppWalkthrough
          toggleY={toggleY}
          insetTop={insets.top}
          onComplete={() => setShowWalkthrough(false)}
        />
      )}

      {/* Notifications Modal */}
      <Modal visible={showNotifications} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowNotifications(false)}>
        <View style={notifS.container}>
          <View style={notifS.handle} />
          <View style={notifS.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={notifS.title}>activity</Text>
              <Ionicons name="notifications-outline" size={22} color={colors.teal} />
            </View>
            <TouchableOpacity onPress={() => setShowNotifications(false)} style={notifS.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <View style={notifS.empty}>
            <SunnyAvatar expression="warm" size={60} />
            <Text style={notifS.emptyTitle}>nothing yet.</Text>
            <Text style={notifS.emptyDesc}>notifications are coming soon. you'll hear from us when someone joins your plan.</Text>
          </View>
        </View>
      </Modal>

      {/* Filter Sheet */}
      <Modal visible={showFilterSheet} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowFilterSheet(false)}>
        <View style={filterS.container}>
          <View style={filterS.handle} />
          <View style={filterS.header}>
            <Text style={filterS.title}>filters</Text>
            <TouchableOpacity onPress={() => setShowFilterSheet(false)} style={filterS.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={filterS.scroll} contentContainerStyle={filterS.scrollContent} showsVerticalScrollIndicator={false}>

            {/* ── Distance ── */}
            <Text style={filterS.sectionLabel}>DISTANCE</Text>
            <View style={filterS.pillRow}>
              {["0.5 mi", "1 mi", "5 mi", "10 mi", "25 mi+"].map(d => (
                <TouchableOpacity key={d} onPress={() => setFilterDistance(d)} activeOpacity={0.8}>
                  {filterDistance === d ? (
                    <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={filterS.pillActive}>
                      <Text style={filterS.pillActiveText}>{d}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={filterS.pill}><Text style={filterS.pillText}>{d}</Text></View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Category ── */}
            <Text style={filterS.sectionLabel}>CATEGORY</Text>
            <View style={filterS.optionWrap}>
              {["coffee", "hiking", "markets", "concerts", "fitness", "sports"].map(cat => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                  activeOpacity={0.8}
                  style={[filterS.option, selectedCategory === cat && filterS.optionSelected]}
                >
                  <Text style={[filterS.optionText, selectedCategory === cat && filterS.optionTextSelected]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Age range ── */}
            <Text style={filterS.sectionLabel}>AGE RANGE</Text>
            <View style={filterS.ageRow}>
              <View style={filterS.ageStepper}>
                <Text style={filterS.ageLabel}>min</Text>
                <View style={filterS.stepperRow}>
                  <TouchableOpacity style={filterS.stepBtn} onPress={() => setFilterAgeMin(v => Math.max(18, v - 1))} activeOpacity={0.7}>
                    <Text style={filterS.stepBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={filterS.stepValue}>{filterAgeMin}</Text>
                  <TouchableOpacity style={filterS.stepBtn} onPress={() => setFilterAgeMin(v => Math.min(filterAgeMax - 1, v + 1))} activeOpacity={0.7}>
                    <Text style={filterS.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={filterS.ageDash}>—</Text>
              <View style={filterS.ageStepper}>
                <Text style={filterS.ageLabel}>max</Text>
                <View style={filterS.stepperRow}>
                  <TouchableOpacity style={filterS.stepBtn} onPress={() => setFilterAgeMax(v => Math.max(filterAgeMin + 1, v - 1))} activeOpacity={0.7}>
                    <Text style={filterS.stepBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={filterS.stepValue}>{filterAgeMax}</Text>
                  <TouchableOpacity style={filterS.stepBtn} onPress={() => setFilterAgeMax(v => Math.min(99, v + 1))} activeOpacity={0.7}>
                    <Text style={filterS.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* ── Gender ── */}
            <Text style={filterS.sectionLabel}>GENDER</Text>
            <View style={filterS.pillRow}>
              {["man", "woman", "nonbinary", "all"].map(g => {
                const active = filterGenders.includes(g);
                return (
                  <TouchableOpacity key={g} onPress={() => toggleMulti(filterGenders, g, setFilterGenders)} activeOpacity={0.8}>
                    {active ? (
                      <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={filterS.pillActive}>
                        <Text style={filterS.pillActiveText}>{g}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={filterS.pill}><Text style={filterS.pillText}>{g}</Text></View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Sexuality (locked) ── */}
            <View style={filterS.lockedSectionHeader}>
              <Text style={filterS.sectionLabel}>SEXUALITY</Text>
              <View style={filterS.goBadge}><Text style={filterS.goBadgeText}>Tandem Go</Text></View>
            </View>
            <View style={filterS.pillRow}>
              {["straight", "gay · lesbian", "bisexual", "all"].map(s => (
                <TouchableOpacity key={s} onPress={() => { if (tier === "free") setShowFilterUpsell(true); else toggleMulti(filterSexuality, s, setFilterSexuality); }} activeOpacity={0.8}>
                  <View style={filterS.pillLocked}>
                    <Text style={filterS.pillLockedText}>{s}</Text>
                    {tier === "free" && <Ionicons name="lock-closed" size={10} color={colors.muted} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Religion (locked) ── */}
            <View style={filterS.lockedSectionHeader}>
              <Text style={filterS.sectionLabel}>RELIGION</Text>
              <View style={filterS.goBadge}><Text style={filterS.goBadgeText}>Tandem Go</Text></View>
            </View>
            <View style={filterS.pillRow}>
              {["christian", "jewish", "muslim", "hindu", "buddhist", "spiritual", "agnostic / atheist", "all"].map(r => (
                <TouchableOpacity key={r} onPress={() => { if (tier === "free") setShowFilterUpsell(true); else toggleMulti(filterReligion, r, setFilterReligion); }} activeOpacity={0.8}>
                  <View style={filterS.pillLocked}>
                    <Text style={filterS.pillLockedText}>{r}</Text>
                    {tier === "free" && <Ionicons name="lock-closed" size={10} color={colors.muted} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Personality (locked) ── */}
            <View style={filterS.lockedSectionHeader}>
              <Text style={filterS.sectionLabel}>PERSONALITY</Text>
              <View style={filterS.goBadge}><Text style={filterS.goBadgeText}>Tandem Go</Text></View>
            </View>
            <View style={filterS.pillRow}>
              {["introvert", "extrovert", "ambivert"].map(p => (
                <TouchableOpacity key={p} onPress={() => { if (tier === "free") setShowFilterUpsell(true); else toggleMulti(filterPersonality, p, setFilterPersonality); }} activeOpacity={0.8}>
                  <View style={filterS.pillLocked}>
                    <Text style={filterS.pillLockedText}>{p}</Text>
                    {tier === "free" && <Ionicons name="lock-closed" size={10} color={colors.muted} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Humor (locked) ── */}
            <View style={filterS.lockedSectionHeader}>
              <Text style={filterS.sectionLabel}>HUMOR</Text>
              <View style={filterS.goBadge}><Text style={filterS.goBadgeText}>Tandem Go</Text></View>
            </View>
            <View style={filterS.pillRow}>
              {["dry", "sarcastic", "goofy", "witty", "dad jokes"].map(h => (
                <TouchableOpacity key={h} onPress={() => { if (tier === "free") setShowFilterUpsell(true); else toggleMulti(filterHumor, h, setFilterHumor); }} activeOpacity={0.8}>
                  <View style={filterS.pillLocked}>
                    <Text style={filterS.pillLockedText}>{h}</Text>
                    {tier === "free" && <Ionicons name="lock-closed" size={10} color={colors.muted} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

          </ScrollView>

          <View style={filterS.footer}>
            <TouchableOpacity onPress={() => setShowFilterSheet(false)} style={filterS.applyBtn} activeOpacity={0.88}>
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={filterS.applyBtnInner}>
                <Text style={filterS.applyBtnText}>apply filters</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={resetFilters} activeOpacity={0.7} style={{ alignSelf: "center", marginTop: 10 }}>
              <Text style={filterS.resetText}>reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* I'm In celebration modal */}
      <Modal visible={showCelebModal} animationType="fade" transparent onRequestClose={handleCelebrationDismiss}>
        <View style={celebS.backdrop}>
          <View style={celebS.card}>
            <Text style={celebS.title}>{celebData?.title ?? "you're in!"}</Text>
            <Text style={celebS.subtitle}>{celebData?.subtitle ?? ""}</Text>
            {celebTandemData && onOpenChat ? (
              <TouchableOpacity
                style={celebS.keepGoingBtn}
                onPress={() => { handleCelebrationDismiss(); onOpenChat(celebTandemData); }}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={gradients.brand}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={celebS.keepGoingInner}
                >
                  <Text style={celebS.keepGoingText}>say hey →</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={celebS.keepGoingBtn}
                onPress={handleCelebrationDismiss}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={gradients.brand}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={celebS.keepGoingInner}
                >
                  <Text style={celebS.keepGoingText}>keep going</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => { handleCelebrationDismiss(); setDiscoverMode("myActivity"); }}
              style={{ paddingTop: 12, paddingBottom: 4 }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 13, fontFamily: "Quicksand_400Regular", color: colors.muted, textAlign: "center" }}>
                see your pending requests →
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Post Activity Modal */}
      <Modal visible={showPostModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPostModal(false)} statusBarTranslucent={true}>
        <KeyboardAvoidingView style={[modalS.container, { zIndex: 1 }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={modalS.handle} />
          <View style={modalS.header}>
            <Text style={modalS.title}>create a post</Text>
            <TouchableOpacity onPress={() => setShowPostModal(false)} style={modalS.closeBtn}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={modalS.scroll} contentContainerStyle={modalS.scrollContent} keyboardShouldPersistTaps="handled">
            <TextInput
              style={modalS.heroInput}
              placeholder="what are you doing?"
              placeholderTextColor={colors.muted}
              multiline
              value={postTitle}
              onChangeText={setPostTitle}
            />

            <Text style={modalS.sectionLabel}>CATEGORY</Text>
            <View style={modalS.categoryPillRow}>
              {[
                { key: "outdoors",  label: "outdoors" },
                { key: "food",      label: "food + drinks" },
                { key: "arts",      label: "arts + culture" },
                { key: "fitness",   label: "fitness + wellness" },
                { key: "social",    label: "social + events" },
                { key: "learning",  label: "learning + skills" },
                { key: "travel",    label: "day trips + travel" },
                { key: "games",     label: "games + fun" },
                { key: "music",     label: "music + shows" },
                { key: "other",     label: "something else" },
              ].map(c => (
                <TouchableOpacity
                  key={c.key}
                  onPress={() => {
                    setPostSelectedCategory(prev => prev === c.key ? "" : c.key);
                    if (c.key !== "other") setPostCustomCategory("");
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={[modalS.categoryPill, postSelectedCategory === c.key && modalS.categoryPillActive]}
                >
                  <Text style={[modalS.categoryPillText, postSelectedCategory === c.key && modalS.categoryPillTextActive]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {postSelectedCategory === "other" && (
              <TextInput
                style={modalS.customCategoryInput}
                value={postCustomCategory}
                onChangeText={setPostCustomCategory}
                placeholder="what are you doing?"
                placeholderTextColor={colors.muted}
                maxLength={40}
                autoFocus
              />
            )}

            <Text style={[modalS.sectionLabel, { marginBottom: 6 }]}>WHERE?</Text>
            <LocationAutocomplete
              value={postLocation}
              placeholder="search for a location"
              onSelect={({ description, lat, lng, raw }) => {
                setPostLocation(description);
                setPostLocationLat(lat);
                setPostLocationLng(lng);
                if (shouldNudgeLocation(raw)) {
                  setPendingNudgePlace(raw);
                  setShowLocationNudge(true);
                }
              }}
            />

            {/* Photo picker */}
            <TouchableOpacity
              style={modalS.photoPicker}
              onPress={handlePickPostPhoto}
              activeOpacity={0.8}
            >
              {postPhotoUri ? (
                <>
                  <Image source={{ uri: postPhotoUri }} style={modalS.photoPreview} resizeMode="cover" />
                  <TouchableOpacity
                    style={modalS.photoRemoveBtn}
                    onPress={() => setPostPhotoUri(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={modalS.photoRemoveText}>×</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={{ alignItems: "center", gap: 6 }}>
                  <Ionicons name="camera-outline" size={32} color="#9CA3AF" />
                  <Text style={modalS.photoPickerText}>add a photo (optional)</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={[modalS.sectionLabel, { marginBottom: 6 }]}>WHEN IS IT?</Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.8}
              style={modalS.dateField}
            >
              <Text style={modalS.dateFieldText}>
                {selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" })}
              </Text>
              <Text style={modalS.dateFieldHint}>tap to change</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="spinner"
                minimumDate={new Date()}
                onChange={(_: any, date: any) => { setShowDatePicker(false); setSelectedDate(date); }}
              />
            )}
            <TouchableOpacity
              onPress={() => setShowTimePicker(true)}
              activeOpacity={0.8}
              style={[modalS.dateField, { marginTop: 8 }]}
            >
              <Text style={[modalS.dateFieldText, !selectedTime && { color: colors.muted }]}>
                {selectedTime
                  ? selectedTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                  : "add a time (optional)"}
              </Text>
            </TouchableOpacity>
            {showTimePicker && (
              <DateTimePicker
                value={selectedTime ?? new Date()}
                mode="time"
                display="spinner"
                onChange={(_: any, time: any) => { setShowTimePicker(false); setSelectedTime(time); }}
              />
            )}

            <View style={modalS.spotsRow}>
              <View>
                <Text style={modalS.spotsLabel}>who's coming with you?</Text>
                {postSpots > 2 && (
                  <Text style={modalS.spotsGroupHint}>group activity</Text>
                )}
              </View>
              <View style={modalS.spotsControls}>
                <TouchableOpacity
                  style={modalS.spotsBtn}
                  onPress={() => { setPostSpots(v => Math.max(1, v - 1)); setShowGroupNudge(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={modalS.spotsBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={modalS.spotsNum}>{postSpots === 1 ? "just me + 1" : `me + ${postSpots} others`}</Text>
                <TouchableOpacity
                  style={[modalS.spotsBtnPlus, tier === "free" && postSpots >= maxCompanions ? { opacity: 0.4 } : {}]}
                  onPress={() => {
                    if (tier === "free" && postSpots >= maxCompanions) {
                      setShowGroupNudge(true);
                      return;
                    }
                    setShowGroupNudge(false);
                    setPostSpots(v => v + 1);
                  }}
                  activeOpacity={0.7}
                >
                  <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={modalS.spotsBtnPlusInner}>
                    <Text style={modalS.spotsBtnPlusText}>+</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
            {showGroupNudge && (
              <View style={modalS.groupNudge}>
                <Text style={modalS.groupNudgeText}>groups are a tandem go thing. </Text>
                <TouchableOpacity onPress={() => { setShowPostModal(false); setShowGroupNudge(false); setShowGroupUpsell(true); }}>
                  <Text style={[modalS.groupNudgeText, { color: colors.teal, textDecorationLine: "underline" }]}>upgrade →</Text>
                </TouchableOpacity>
              </View>
            )}

            <TextInput
              style={modalS.descInput}
              placeholder="add any details..."
              placeholderTextColor={colors.muted}
              multiline
              value={postDesc}
              onChangeText={setPostDesc}
            />

            <TouchableOpacity style={modalS.postBtn} activeOpacity={0.88}
              onPress={handleSubmitPost} disabled={isPosting}>
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={modalS.postBtnInner}>
                {isPosting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={modalS.postBtnText}>post it →</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Host Profile Overlay ─────────────────────────────── */}
      <Modal
        visible={showHostProfile}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowHostProfile(false)}
      >
        {profileActivity && (() => {
          const host = profileActivity.host;
          const p = hostProfileFetched;
          const age = p?.birthday ? calculateAge(p.birthday) : null;
          const humorTypes: string[] = Array.isArray(p?.humor_type) ? p.humor_type : [];
          const usageReasons: string[] = Array.isArray(p?.usage_reasons) ? p.usage_reasons : [];
          const quickPrompts: Record<string, string> = (p?.quick_prompts && typeof p.quick_prompts === "object") ? p.quick_prompts : {};
          const deepPrompts: Record<string, string> = (p?.deep_prompts && typeof p.deep_prompts === "object") ? p.deep_prompts : {};

          // Compute compatibility overlaps (max 3)
          const overlaps: string[] = [];
          if (ownProfile) {
            const ownHumor: string[] = Array.isArray(ownProfile.humor_type) ? ownProfile.humor_type : [];
            const ownUsage: string[] = Array.isArray(ownProfile.usage_reasons) ? ownProfile.usage_reasons : [];
            const sharedHumor = humorTypes.filter(h => ownHumor.map(x => x.toLowerCase()).includes(h.toLowerCase()));
            if (sharedHumor.length > 0) overlaps.push(`you're both ${sharedHumor[0].toLowerCase()}`);
            const sharedUsage = usageReasons.filter(u => ownUsage.map(x => x.toLowerCase()).includes(u.toLowerCase()));
            if (sharedUsage.length > 0) overlaps.push(`you both want ${sharedUsage[0].toLowerCase()}`);
            if (p?.personality_type && ownProfile.personality_type &&
                p.personality_type.toLowerCase() === ownProfile.personality_type.toLowerCase()) {
              overlaps.push(`fellow ${p.personality_type.toLowerCase()}`);
            }
            const ownSat = ownProfile.quick_prompts?.ideal_saturday;
            const hostSat = quickPrompts.ideal_saturday;
            if (ownSat && hostSat && ownSat.toLowerCase() === hostSat.toLowerCase()) {
              overlaps.push(`you'd both spend saturday: ${hostSat}`);
            }
          }
          const topOverlaps = overlaps.slice(0, 3);

          const isMediaValue = (v: string) =>
            typeof v === "string" && (v.startsWith("file://") || /\.(mov|mp4|m4a)$/i.test(v));

          return (
            <View style={hostS.container}>
              <View style={hostS.handle} />
              <View style={hostS.topBar}>
                <TouchableOpacity onPress={() => setShowHostProfile(false)} style={hostS.closeBtn} activeOpacity={0.7}>
                  <Ionicons name="close" size={20} color={colors.muted} />
                </TouchableOpacity>
              </View>

              {hostProfileLoading ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <ActivityIndicator color={colors.teal} size="large" />
                </View>
              ) : (
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={hostS.scrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Avatar + name + age + location */}
                  <View style={hostS.heroSection}>
                    {(p?.avatar_url || host.photo) ? (
                      <Image source={{ uri: p?.avatar_url || host.photo }} style={hostS.avatar} />
                    ) : (
                      <View style={[hostS.avatar, hostS.avatarPlaceholder]}>
                        <Text style={hostS.avatarInitial}>{(host.name ?? "?").charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <Text style={hostS.name}>{p?.first_name ?? host.name}</Text>
                    {age !== null && (
                      <Text style={hostS.ageLine}>{age} years old</Text>
                    )}
                    {p?.occupation ? (
                      <Text style={hostS.occupation}>{p.occupation}</Text>
                    ) : null}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <Ionicons name="location-outline" size={13} color={colors.muted} />
                      <Text style={hostS.location}>{profileActivity.location}</Text>
                    </View>
                  </View>

                  {/* Compatibility section */}
                  {topOverlaps.length > 0 && (
                    <View style={hostS.compatCard}>
                      <Text style={hostS.compatHeading}>you'd get along because...</Text>
                      {topOverlaps.map((line, i) => (
                        <Text key={i} style={hostS.compatLine}>· {line}</Text>
                      ))}
                    </View>
                  )}

                  {/* Personality type pill */}
                  {p?.personality_type ? (
                    <View style={hostS.section}>
                      <Text style={hostS.sectionLabel}>PERSONALITY</Text>
                      <View style={hostS.pillRow}>
                        <View style={hostS.pillTeal}>
                          <Text style={hostS.pillTealText}>{p.personality_type}</Text>
                        </View>
                      </View>
                    </View>
                  ) : null}

                  {/* Humor type pills */}
                  {humorTypes.length > 0 && (
                    <View style={hostS.section}>
                      <Text style={hostS.sectionLabel}>HUMOR</Text>
                      <View style={hostS.pillRow}>
                        {humorTypes.map(h => (
                          <View key={h} style={hostS.pill}>
                            <Text style={hostS.pillText}>{h}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Usage reasons pills */}
                  {usageReasons.length > 0 && (
                    <View style={hostS.section}>
                      <Text style={hostS.sectionLabel}>INTO</Text>
                      <View style={hostS.pillRow}>
                        {usageReasons.map(r => (
                          <View key={r} style={hostS.pill}>
                            <Text style={hostS.pillText}>{r}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Quick prompts */}
                  {Object.entries(quickPrompts).filter(([, v]) => v && !isMediaValue(v)).length > 0 && (
                    <View style={hostS.section}>
                      {Object.entries(quickPrompts)
                        .filter(([, v]) => v && !isMediaValue(v))
                        .map(([q, a]) => (
                          <View key={q} style={hostS.promptCard}>
                            <Text style={hostS.promptQ}>{q.replace(/_/g, " ")}</Text>
                            <Text style={hostS.promptA}>{a}</Text>
                          </View>
                        ))}
                    </View>
                  )}

                  {/* Deep prompts (text only) */}
                  {Object.entries(deepPrompts).filter(([, v]) => v && !isMediaValue(v)).length > 0 && (
                    <View style={hostS.section}>
                      {Object.entries(deepPrompts)
                        .filter(([, v]) => v && !isMediaValue(v))
                        .map(([q, a]) => (
                          <View key={q} style={hostS.promptCard}>
                            <Text style={hostS.promptQ}>{q}</Text>
                            <Text style={hostS.promptA}>{a}</Text>
                          </View>
                        ))}
                    </View>
                  )}
                </ScrollView>
              )}

              {/* Sticky bottom bar */}
              <View style={hostS.stickyBar}>
                <TouchableOpacity
                  style={hostS.msgBtn}
                  activeOpacity={0.8}
                  onPress={() => {
                    setShowHostProfile(false);
                    if (onMessagesPress) {
                      onMessagesPress();
                    } else {
                      showToast("messaging coming soon.");
                    }
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={hostS.msgBtnText}>say hey</Text>
                    <Text style={{ fontFamily: "System", fontSize: 18 }}>👋</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}
      </Modal>

      {/* ── Viewer Profile (read-only, from interested list) ── */}
      <Modal
        visible={showViewerProfile}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowViewerProfile(false)}
      >
        <View style={viewerS.container}>
          <View style={viewerS.handle} />
          <View style={viewerS.topBar}>
            <TouchableOpacity onPress={() => setShowViewerProfile(false)} style={viewerS.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>
          {viewerProfileLoading ? (
            <View style={viewerS.loaderWrap}>
              <ActivityIndicator color={colors.teal} size="large" />
            </View>
          ) : viewerProfileData ? (() => {
            const vp = viewerProfileFetched;
            const vAge = vp?.birthday ? calculateAge(vp.birthday) : null;
            const vHumor: string[] = Array.isArray(vp?.humor_type) ? vp.humor_type : [];
            const vUsage: string[] = Array.isArray(vp?.usage_reasons) ? vp.usage_reasons : [];
            const vQuick: Record<string, string> = (vp?.quick_prompts && typeof vp.quick_prompts === "object") ? vp.quick_prompts : {};
            const vDeep: Record<string, string> = (vp?.deep_prompts && typeof vp.deep_prompts === "object") ? vp.deep_prompts : {};
            const isMediaValue = (v: string) =>
              typeof v === "string" && (v.startsWith("file://") || /\.(mov|mp4|m4a)$/i.test(v));
            return (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={viewerS.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={viewerS.heroSection}>
                  {(vp?.avatar_url || viewerProfileData.photo) ? (
                    <Image source={{ uri: vp?.avatar_url || viewerProfileData.photo }} style={viewerS.avatar} />
                  ) : (
                    <View style={[viewerS.avatar, viewerS.avatarPlaceholder]}>
                      <Text style={viewerS.initials}>{(viewerProfileData.name ?? "?").charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={viewerS.name}>{vp?.first_name ?? viewerProfileData.name}</Text>
                  {vAge !== null && <Text style={viewerS.hint}>{vAge} years old</Text>}
                  {vp?.occupation ? <Text style={viewerS.occupation}>{vp.occupation}</Text> : null}
                </View>

                {/* Compatibility section */}
                {(() => {
                  const overlaps: string[] = [];
                  if (ownProfile) {
                    const ownHumor: string[] = Array.isArray(ownProfile.humor_type) ? ownProfile.humor_type : [];
                    const ownUsage: string[] = Array.isArray(ownProfile.usage_reasons) ? ownProfile.usage_reasons : [];
                    const sharedHumor = vHumor.filter(h => ownHumor.map((x: string) => x.toLowerCase()).includes(h.toLowerCase()));
                    if (sharedHumor.length > 0) overlaps.push(`you're both ${sharedHumor[0].toLowerCase()}`);
                    const sharedUsage = vUsage.filter(u => ownUsage.map((x: string) => x.toLowerCase()).includes(u.toLowerCase()));
                    if (sharedUsage.length > 0) overlaps.push(`you both want ${sharedUsage[0].toLowerCase()}`);
                    if (vp?.personality_type && ownProfile.personality_type &&
                        vp.personality_type.toLowerCase() === ownProfile.personality_type.toLowerCase()) {
                      overlaps.push(`fellow ${vp.personality_type.toLowerCase()}`);
                    }
                    const ownSat = ownProfile.quick_prompts?.ideal_saturday;
                    const viewerSat = vQuick.ideal_saturday;
                    if (ownSat && viewerSat && ownSat.toLowerCase() === viewerSat.toLowerCase()) {
                      overlaps.push(`you'd both spend saturday: ${viewerSat}`);
                    }
                  }
                  const shown = overlaps.slice(0, 3);
                  if (shown.length === 0) return null;
                  return (
                    <View style={viewerS.compatCard}>
                      <Text style={viewerS.compatHeading}>you'd get along because...</Text>
                      {shown.map((o, i) => (
                        <Text key={i} style={viewerS.compatLine}>· {o}</Text>
                      ))}
                    </View>
                  );
                })()}

                {vp?.personality_type ? (
                  <View style={viewerS.section}>
                    <Text style={viewerS.sectionLabel}>PERSONALITY</Text>
                    <View style={viewerS.pillRow}>
                      <View style={[viewerS.pill, { borderColor: colors.teal, backgroundColor: colors.tintTeal }]}>
                        <Text style={[viewerS.pillText, { color: colors.teal }]}>{vp.personality_type}</Text>
                      </View>
                    </View>
                  </View>
                ) : null}

                {vHumor.length > 0 && (
                  <View style={viewerS.section}>
                    <Text style={viewerS.sectionLabel}>HUMOR</Text>
                    <View style={viewerS.pillRow}>
                      {vHumor.map(h => (
                        <View key={h} style={viewerS.pill}>
                          <Text style={viewerS.pillText}>{h}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {vUsage.length > 0 && (
                  <View style={viewerS.section}>
                    <Text style={viewerS.sectionLabel}>INTO</Text>
                    <View style={viewerS.pillRow}>
                      {vUsage.map(r => (
                        <View key={r} style={viewerS.pill}>
                          <Text style={viewerS.pillText}>{r}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {Object.entries(vQuick).filter(([, v]) => v && !isMediaValue(v)).length > 0 && (
                  <View style={viewerS.section}>
                    {Object.entries(vQuick)
                      .filter(([, v]) => v && !isMediaValue(v))
                      .map(([q, a]) => (
                        <View key={q} style={viewerS.promptCard}>
                          <Text style={viewerS.promptQ}>{q.replace(/_/g, " ")}</Text>
                          <Text style={viewerS.promptA}>{a}</Text>
                        </View>
                      ))}
                  </View>
                )}

                {Object.entries(vDeep).filter(([, v]) => v && !isMediaValue(v)).length > 0 && (
                  <View style={viewerS.section}>
                    {Object.entries(vDeep)
                      .filter(([, v]) => v && !isMediaValue(v))
                      .map(([q, a]) => (
                        <View key={q} style={viewerS.promptCard}>
                          <Text style={viewerS.promptQ}>{q}</Text>
                          <Text style={viewerS.promptA}>{a}</Text>
                        </View>
                      ))}
                  </View>
                )}
              </ScrollView>
            );
          })() : null}
        </View>
      </Modal>

      {/* Upsell Sheet — i'm in limit */}
      <UpsellSheet
        visible={showUpsell}
        onDismiss={() => setShowUpsell(false)}
        onUpgrade={() => { setShowUpsell(false); onMembershipPress?.(); }}
        headline="you've used your 5 free i'm ins."
        subtext="upgrade to tandem go for unlimited access to activities every month."
      />

      {/* Upsell Sheet — group activity */}
      <UpsellSheet
        visible={showGroupUpsell}
        onDismiss={() => setShowGroupUpsell(false)}
        onUpgrade={() => { setShowGroupUpsell(false); onMembershipPress?.(); }}
        headline="groups are a tandem go thing."
        subtext="upgrade to host adventures for more than one person."
      />

      {/* Upsell Sheet — locked filters */}
      <UpsellSheet
        visible={showFilterUpsell}
        onDismiss={() => setShowFilterUpsell(false)}
        onUpgrade={() => { setShowFilterUpsell(false); setShowFilterSheet(false); onMembershipPress?.(); }}
        headline="advanced filters are a tandem go thing."
        subtext="filter by sexuality, religion, personality, and humor with tandem go."
      />

      {/* Request Sheet */}
      <Modal
        visible={showRequestSheet}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRequestSheet(false)}
      >
        <View style={reqS.container}>
          <View style={reqS.handle} />
          <View style={reqS.header}>
            <Text style={reqS.title} numberOfLines={1}>who wants in</Text>
            <TouchableOpacity onPress={() => setShowRequestSheet(false)} style={reqS.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={reqS.scroll} contentContainerStyle={reqS.scrollContent} showsVerticalScrollIndicator={false}>

            {/* ── Interested: people who tapped "i'm in" ── */}
            {(requestSheetActivity?.interestedUsers?.length ?? 0) > 0 && (
              <View style={reqS.interestedSection}>
                <Text style={reqS.interestedLabel}>
                  interested ({requestSheetActivity.interestedUsers.length})
                </Text>
                {requestSheetActivity.interestedUsers.map((u: any) => (
                  <TouchableOpacity
                    key={u.id}
                    style={reqS.interestedRow}
                    activeOpacity={0.85}
                    onPress={() => {
                      setViewerProfileData({ id: u.id, name: u.name, photo: u.photo });
                      setShowViewerProfile(true);
                    }}
                  >
                    {u.photo ? (
                      <Image source={{ uri: u.photo }} style={reqS.requesterAvatar} />
                    ) : (
                      <View style={[reqS.requesterAvatar, reqS.requesterAvatarPlaceholder]}>
                        <Text style={reqS.requesterAvatarInitial}>
                          {(u.name ?? "?").charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={reqS.requesterName}>{u.name}</Text>
                      <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>tap to view profile</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* ── Pending approvals ── */}
            {(requestSheetActivity?.pendingRequests?.length ?? 0) > 0 && (
              <Text style={reqS.interestedLabel}>requests</Text>
            )}
            {(requestSheetActivity?.pendingRequests.length ?? 0) === 0 && (requestSheetActivity?.interestedUsers?.length ?? 0) === 0 ? (
              <View style={reqS.empty}>
                <SunnyAvatar expression="warm" size={56} />
                <Text style={reqS.emptyTitle}>no activity yet.</Text>
                <Text style={reqS.emptyDesc}>when someone wants in, they'll show up here.</Text>
              </View>
            ) : (
              requestSheetActivity?.pendingRequests.map((req: any) => {
                const atLimit = (approvedCounts[requestSheetActivity.id] ?? 0) >= getApprovalLimit();
                return (
                  <View key={req.id} style={reqS.requesterRow}>
                    <Image source={{ uri: req.photo }} style={reqS.requesterAvatar} />
                    <View style={reqS.requesterInfo}>
                      <Text style={reqS.requesterName}>{req.name}</Text>
                      <Text style={reqS.requesterBio} numberOfLines={2}>{req.bio}</Text>
                    </View>
                    <View style={reqS.requesterActions}>
                      {atLimit ? (
                        <View style={reqS.letInBtnLocked}>
                          <Ionicons name="lock-closed-outline" size={11} color={colors.muted} />
                          <Text style={reqS.letInBtnLockedText}>
                            {tier === "free" ? "go" : "trail"}
                          </Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={reqS.letInBtn}
                          activeOpacity={0.88}
                          onPress={() => handleLetIn(
                            requestSheetActivity.id,
                            req.id,
                            req.name,
                            requestSheetActivity.title,
                          )}
                        >
                          <Text style={reqS.letInBtnText}>let's tandem</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={reqS.passBtn}
                        activeOpacity={0.8}
                        onPress={() => handlePass(requestSheetActivity.id, req.id)}
                      >
                        <Text style={reqS.passBtnText}>pass</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>

      <SafetyCheckIn
        visible={!!safetyCheckInActivity}
        onConfirm={() => {
          const act = safetyCheckInActivity;
          setSafetyCheckInActivity(null);
          if (act) executeImIn(act.id);
        }}
        onDismiss={() => setSafetyCheckInActivity(null)}
        activityTitle={safetyCheckInActivity?.title ?? ""}
        location={safetyCheckInActivity?.location ?? ""}
        dateTime={`${safetyCheckInActivity?.date ?? ""}${safetyCheckInActivity?.time ? ` at ${safetyCheckInActivity.time}` : ""}`}
        posterFirstName={safetyCheckInActivity?.host?.name ?? "them"}
        posterId={safetyCheckInActivity?.host?.user_id ?? ""}
      />

      <PrivateLocationNudge
        visible={showLocationNudge}
        onChangeLocation={() => {
          setShowLocationNudge(false);
          setPendingNudgePlace(null);
          setPostLocation("");
          setPostLocationLat(null);
          setPostLocationLng(null);
        }}
        onKeepAsIs={() => {
          setShowLocationNudge(false);
          setPendingNudgePlace(null);
        }}
        onDismiss={() => setShowLocationNudge(false)}
      />

      <FirstJoinReminder
        visible={showFirstJoinReminder}
        onPress={() => {
          setShowFirstJoinReminder(false);
          onSafetyPress?.();
        }}
        onDismiss={() => setShowFirstJoinReminder(false)}
      />
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerLeft: { gap: 2 },
  greeting: { fontSize: 12, color: colors.muted, fontWeight: "500", fontFamily: "Quicksand_500Medium" },
  headerTitle: { fontSize: 26, fontWeight: "800", fontFamily: "Quicksand_700Bold", color: colors.foreground, letterSpacing: -0.5 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.tintTeal, alignItems: "center", justifyContent: "center" },
  iconBadge: { position: "absolute", top: 7, right: 7, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.teal, borderWidth: 1.5, borderColor: colors.background },
  avatarBtn: {},
  avatarRing: { width: 38, height: 38, borderRadius: 19, padding: 2 },
  avatarInner: { flex: 1, borderRadius: 17, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },

  myActivityHint: {
    fontSize: 11,
    color: colors.muted,
    paddingHorizontal: 16,
    paddingBottom: 6,
    fontWeight: "500",
    fontFamily: "Quicksand_500Medium",
  },

  // Sub-tabs (my posts / saved)
  subTabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  subTab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  subTabActive: {
    borderColor: colors.teal,
    backgroundColor: colors.tintTeal,
  },
  subTabText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Quicksand_600SemiBold",
    color: colors.muted,
  },
  subTabTextActive: {
    color: colors.teal,
  },

  // Browse / My Activity toggle
  modeToggleRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, backgroundColor: colors.background },
  modeToggle: { flexDirection: "row", backgroundColor: "#F3F4F6", borderRadius: radius.full, padding: 3 },
  modeToggleBtn: { flex: 1, overflow: "hidden", borderRadius: radius.full },
  modeActive: { paddingVertical: 8, borderRadius: radius.full, alignItems: "center" },
  modeActiveText: { fontSize: 13, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.white },
  modeInactive: { paddingVertical: 8, alignItems: "center" },
  modeInactiveText: { fontSize: 13, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: "#6B7280" },

  // Filter pills
  filtersScroll: { flexGrow: 0 },
  filtersContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, flexDirection: "row" },
  filterPill: {
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: colors.white, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border,
  },
  filterPillActive: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.full },
  filterText: { fontSize: 13, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.foreground },
  filterTextActive: { fontSize: 13, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.white },

  // Feed (My Activity tab)
  feed: { flex: 1 },
  feedContent: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },

  // My Activity empty state
  myActivityEmpty: { alignItems: "center", paddingTop: 80, gap: 12 },
  myActivityEmptyTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground },
  myActivityEmptyDesc: { fontSize: 14, fontFamily: "Quicksand_400Regular", color: colors.muted, textAlign: "center", maxWidth: 260, lineHeight: 20 },

  // My posts list
  myPostRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.white, borderRadius: radius.md,
    padding: 12, ...shadows.card,
  },
  myPostPhoto: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surface },
  myPostInfo: { flex: 1, gap: 3 },
  myPostTitle: { fontSize: 15, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground, letterSpacing: -0.2 },
  myPostDate: { fontSize: 12, fontFamily: "Quicksand_400Regular", color: colors.muted },
  requestBadge: {
    backgroundColor: colors.tintTeal, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  requestBadgeText: { fontSize: 11, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.teal },

  // Card deck
  deckContainer: { flex: 1, paddingHorizontal: 16, paddingBottom: 80 },
  deckProgress: { fontSize: 12, fontFamily: "Quicksand_400Regular", color: colors.muted, paddingTop: 10, paddingBottom: 6 },
  deckDone: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingBottom: 80 },
  deckDoneTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground, textAlign: "center" },
  deckDoneDesc: { fontSize: 14, fontFamily: "Quicksand_400Regular", color: colors.muted, textAlign: "center", maxWidth: 260, lineHeight: 20 },

  // Card scroll
  cardScroll: { flex: 1 },
  cardScrollContent: { paddingTop: 4, paddingBottom: 8 },

  // Activity card
  cardWrapper: { gap: 0 },
  card: {
    backgroundColor: colors.white, borderRadius: radius.lg,
    overflow: "hidden", ...shadows.card,
  },
  cardSaved: {
    borderLeftWidth: 3,
    borderLeftColor: colors.teal,
  },
  savedPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: "#F0FDFB",
  },
  savedPillText: { fontSize: 11, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.teal },
  bookmarkBtn: {
    position: "absolute", top: 12, right: 12,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderRadius: 20, padding: 6,
  },
  photoWrap: { position: "relative" },
  cardPhoto: { width: "100%", height: 260, backgroundColor: colors.surface },
  categoryPill: {
    position: "absolute", bottom: 12, left: 12,
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.9)", borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  categoryPillText: { fontSize: 11, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground },
  featuredBadge: {
    position: "absolute", top: 12, right: 12,
    borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4,
  },
  featuredBadgeText: { fontSize: 10, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.white },

  cardBody: { padding: 20, gap: 0 },
  cardTitle: { fontSize: 20, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground, letterSpacing: -0.3, marginBottom: 12 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardMetaTeal: { fontSize: 13, color: colors.teal, fontWeight: "600", fontFamily: "Quicksand_600SemiBold" },
  cardMetaGray: { fontSize: 13, fontFamily: "Quicksand_400Regular", color: colors.muted },
  vibeBox: {
    borderLeftWidth: 3, borderLeftColor: colors.teal,
    backgroundColor: "#F0FDFB", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  vibeText: { fontSize: 14, fontFamily: "Quicksand_400Regular", fontStyle: "italic", color: colors.secondary, lineHeight: 20 },

  // Attendee row
  goingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatarStack: { flexDirection: "row" },
  stackAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: colors.white, backgroundColor: colors.surface },
  goingText: { fontSize: 12, color: colors.muted, fontWeight: "500", fontFamily: "Quicksand_500Medium" },

  // Host strip below card
  hostStrip: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 10,
    gap: 10,
  },
  hostStripAvatarWrap: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1.5, borderColor: colors.teal,
    padding: 1,
  },
  hostStripAvatar: { width: "100%", height: "100%", borderRadius: 15, backgroundColor: colors.surface },
  hostStripInfo: { flex: 1 },
  hostStripLabel: { fontSize: 13, fontFamily: "Quicksand_400Regular", color: colors.muted },
  hostStripName: { fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground },
  hostStripBio: { fontSize: 11, fontFamily: "Quicksand_400Regular", fontStyle: "italic", color: colors.muted, marginTop: 1 },
  viewProfile: { fontSize: 13, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.teal },

  // Action buttons row
  actionRow: {
    flexDirection: "row", gap: 8,
    paddingTop: 8, paddingHorizontal: 16,
    backgroundColor: colors.background,
  },
  passBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  passBtnText: { fontSize: 13, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: "#6B7280" },
  imInBtn: {
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2DD4BF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  imInBtnText: { fontSize: 15, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.white },
  requestedBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  requestedBtnText: { fontSize: 15, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.muted },

  // Vibe emoji tag pills
  vibeTagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  vibeTagPill: {
    backgroundColor: colors.white, borderRadius: radius.full,
    borderWidth: 1, borderColor: "#E5E7EB",
    paddingHorizontal: 8, paddingVertical: 6,
  },
  vibeTagText: { fontSize: 12, fontFamily: "Quicksand_400Regular", color: colors.foreground },

  // Prompt answer cards (on card)
  promptCard: {
    backgroundColor: "#FAFAFA", borderRadius: 10,
    borderWidth: 1, borderColor: "#E5E7EB",
    padding: 12, gap: 4,
  },
  promptCardQ: { fontSize: 10, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: "#9CA3AF", letterSpacing: 0.8, textTransform: "uppercase" },
  promptCardA: { fontSize: 14, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.foreground, lineHeight: 20 },

  // Toast
  toast: {
    position: "absolute", bottom: 100, alignSelf: "center",
    backgroundColor: "rgba(15,23,42,0.85)", borderRadius: radius.full,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  toastText: { fontSize: 13, color: colors.white, fontWeight: "500", fontFamily: "Quicksand_500Medium" },

  saveToast: {
    position: "absolute", bottom: 112, left: 24, right: 24,
    backgroundColor: "#FAF7F0", borderRadius: 10,
    borderWidth: 1, borderColor: "#E0D8C8",
    paddingHorizontal: 16, paddingVertical: 10,
    alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  saveToastText: { fontSize: 13, color: "#6B7280", textAlign: "center" },

  // Locked filter indicator
  lockedFilterPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    alignSelf: "flex-start", marginTop: 10,
    backgroundColor: colors.tintTeal, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.teal,
  },
  lockedFilterText: { fontSize: 11, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.teal },
});

const notifS = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  handle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginTop: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 22, fontWeight: "800", fontFamily: "Quicksand_700Bold", color: colors.foreground, letterSpacing: -0.5 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingBottom: 80 },
  emptyTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground },
  emptyDesc: { fontSize: 14, fontFamily: "Quicksand_400Regular", color: colors.muted, textAlign: "center", maxWidth: 260, lineHeight: 20 },
});

const filterS = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  handle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginTop: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 22, fontWeight: "800", fontFamily: "Quicksand_700Bold", color: colors.foreground, letterSpacing: -0.5 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  resetText: { fontSize: 14, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.teal },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 6, paddingBottom: 24 },
  sectionLabel: { fontSize: 10, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.muted, letterSpacing: 1.2, marginTop: 16, marginBottom: 10 },
  lockedSectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, marginBottom: 10 },
  goBadge: { backgroundColor: colors.tintTeal, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  goBadgeText: { fontSize: 11, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.teal },

  // Pill rows (free)
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.full, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border },
  pillText: { fontSize: 13, fontWeight: "500", fontFamily: "Quicksand_500Medium", color: colors.foreground },
  pillActive: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.full },
  pillActiveText: { fontSize: 13, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.white },

  // Locked pills
  pillLocked: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, opacity: 0.7,
  },
  pillLockedText: { fontSize: 13, fontWeight: "500", fontFamily: "Quicksand_500Medium", color: colors.muted },

  // Age stepper
  ageRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  ageStepper: { flex: 1, alignItems: "center", gap: 6 },
  ageLabel: { fontSize: 11, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.muted, letterSpacing: 0.8 },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  stepBtnText: { fontSize: 20, fontWeight: "300", fontFamily: "Quicksand_400Regular", color: colors.foreground, lineHeight: 24 },
  stepValue: { fontSize: 20, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground, minWidth: 32, textAlign: "center" },
  ageDash: { fontSize: 18, fontFamily: "Quicksand_400Regular", color: colors.muted, paddingTop: 20 },

  // Footer
  footer: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  applyBtn: { height: 52, borderRadius: radius.full, overflow: "hidden", ...shadows.brand },
  applyBtnInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  applyBtnText: { fontSize: 15, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.white },
  optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  optionSelected: { borderColor: colors.teal, backgroundColor: colors.tintTeal },
  optionText: { fontSize: 13, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.secondary },
  optionTextSelected: { color: colors.teal },
});

const modalS = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  handle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginTop: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 18, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 16, paddingBottom: 80 },
  heroInput: {
    fontSize: 20, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground,
    borderBottomWidth: 2, borderBottomColor: colors.border,
    paddingBottom: 12, paddingTop: 4,
    minHeight: 50,
  },
  sectionLabel: { fontSize: 10, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.muted, letterSpacing: 1.2 },
  categoryScroll: { flexGrow: 0 },
  categoryRow: { flexDirection: "row", gap: 10 },
  categoryTile: {
    width: 80, paddingVertical: 12, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white,
    alignItems: "center", gap: 6,
  },
  categoryEmoji: { fontSize: 22 },
  categoryLabel: { fontSize: 11, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.foreground },
  rowFields: { flexDirection: "row", gap: 10 },
  pillField: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.white, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  locationField: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.white, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  pillFieldText: { fontSize: 14, color: colors.muted, fontWeight: "500", fontFamily: "Quicksand_500Medium" },
  spotsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  spotsLabel: { fontSize: 14, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.foreground },
  spotsControls: { flexDirection: "row", alignItems: "center", gap: 16 },
  spotsBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  spotsBtnText: { fontSize: 18, fontWeight: "300", fontFamily: "Quicksand_400Regular", color: colors.foreground, lineHeight: 22 },
  spotsNum: { fontSize: 18, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground, minWidth: 24, textAlign: "center" },
  spotsGroupHint: { fontSize: 11, color: colors.teal, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", marginTop: 2 },
  spotsBtnPlus: { width: 32, height: 32, borderRadius: 16, overflow: "hidden" },
  spotsBtnPlusInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  spotsBtnPlusText: { fontSize: 18, fontWeight: "300", fontFamily: "Quicksand_400Regular", color: colors.white, lineHeight: 22 },
  groupRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  groupLabel: { fontSize: 14, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.foreground },
  descInput: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: colors.foreground, minHeight: 80,
    textAlignVertical: "top",
  },
  postBtn: { height: 52, borderRadius: radius.full, overflow: "hidden", ...shadows.brand },
  postBtnInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  postBtnText: { fontSize: 15, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.white },
  groupNudge: {
    flexDirection: "row", flexWrap: "wrap", alignItems: "center",
    backgroundColor: "#F0FDFB", borderRadius: 8,
    borderLeftWidth: 3, borderLeftColor: colors.teal,
    paddingHorizontal: 12, paddingVertical: 10,
    marginTop: -8,
  },
  groupNudgeText: { fontSize: 13, fontFamily: "Quicksand_400Regular", color: colors.muted },
  categoryPillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  categoryPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100,
    backgroundColor: colors.white, borderWidth: 1, borderColor: "#E0D8C8",
  },
  categoryPillActive: { backgroundColor: "#1D9E75", borderColor: "#1D9E75" },
  categoryPillText: { fontSize: 14, color: "#444", fontFamily: "Caveat_400Regular" },
  categoryPillTextActive: { color: colors.white },
  customCategoryInput: {
    marginTop: 10, borderWidth: 0.5, borderColor: "#E0D8C8",
    borderRadius: 10, padding: 12,
    fontSize: 15, color: colors.foreground,
    backgroundColor: colors.white,
  },
  dateField: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 0.5, borderColor: "#E0D8C8",
    borderRadius: 10, padding: 14,
    backgroundColor: colors.white,
  },
  dateFieldText: { fontFamily: "Caveat_400Regular", fontSize: 16, color: colors.foreground },
  dateFieldHint: { fontSize: 12, fontFamily: "Quicksand_400Regular", color: colors.muted },

  photoPicker: {
    height: 160, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border,
    borderStyle: "dashed", backgroundColor: "#F9FAFB",
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  photoPreview: { width: "100%", height: "100%", borderRadius: 16 },
  photoRemoveBtn: {
    position: "absolute", top: 8, right: 8,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center",
  },
  photoRemoveText: { color: "#fff", fontSize: 16, lineHeight: 20, textAlign: "center" },
  photoPickerText: { fontSize: 13, color: "#9CA3AF", fontFamily: "Quicksand_400Regular" },
});

const celebS = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32,
  },
  card: {
    width: "100%", backgroundColor: colors.white,
    borderRadius: radius.xl ?? 20,
    paddingHorizontal: 24, paddingVertical: 28,
    alignItems: "center", gap: 4,
    ...shadows.float,
  },
  title: { fontSize: 22, fontWeight: "800", fontFamily: "Quicksand_700Bold", color: colors.foreground, textAlign: "center", marginBottom: 6 },
  subtitle: { fontSize: 14, fontFamily: "Quicksand_400Regular", color: colors.muted, textAlign: "center", lineHeight: 20, marginBottom: 16 },
  keepGoingBtn: { width: "100%", height: 52, borderRadius: 26, overflow: "hidden" },
  keepGoingInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  keepGoingText: { fontSize: 15, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.white },
});

const reqS = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  handle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginTop: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 18, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground, flex: 1, marginRight: 12 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 40 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground },
  emptyDesc: { fontSize: 14, fontFamily: "Quicksand_400Regular", color: colors.muted, textAlign: "center", maxWidth: 260, lineHeight: 20 },
  requesterRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.white, borderRadius: radius.md,
    padding: 14, ...shadows.card,
  },
  requesterAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface },
  requesterInfo: { flex: 1, gap: 2 },
  requesterName: { fontSize: 15, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground },
  requesterBio: { fontSize: 12, fontFamily: "Quicksand_400Regular", color: colors.muted, lineHeight: 17 },
  requesterActions: { flexDirection: "column", gap: 6, alignItems: "flex-end" },
  letInBtn: {
    backgroundColor: colors.teal, borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  letInBtnText: { fontSize: 12, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.white },
  passBtn: {
    backgroundColor: colors.white, borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1.5, borderColor: colors.border,
  },
  passBtnText: { fontSize: 12, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.muted },
  letInBtnLocked: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.surface, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.border, opacity: 0.6,
  },
  letInBtnLockedText: { fontSize: 11, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.muted },
  interestedSection: { gap: 8, marginBottom: 4 },
  interestedLabel: {
    fontSize: 10, fontWeight: "700", fontFamily: "Quicksand_700Bold",
    color: colors.muted, letterSpacing: 1.2, textTransform: "uppercase",
    marginBottom: 4,
  },
  interestedRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.white, borderRadius: radius.md,
    padding: 14, ...shadows.card,
  },
  requesterAvatarPlaceholder: {
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.tintTeal,
  },
  requesterAvatarInitial: {
    fontSize: 17, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.teal,
  },
});

const hostS = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  handle: {
    width: 36, height: 4, backgroundColor: colors.border,
    borderRadius: 2, alignSelf: "center", marginTop: 12,
  },
  topBar: {
    flexDirection: "row", justifyContent: "flex-end",
    paddingHorizontal: 20, paddingTop: 8,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
  },
  scrollContent: { padding: 24, gap: 20, paddingBottom: 120 },

  // Hero
  heroSection: { alignItems: "center", gap: 4 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.surface, marginBottom: 8,
  },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: colors.tintTeal },
  avatarInitial: { fontSize: 28, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.teal },
  name: { fontSize: 22, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground, letterSpacing: -0.4 },
  ageLine: { fontSize: 13, fontFamily: "Quicksand_400Regular", color: colors.muted },
  occupation: { fontSize: 13, fontFamily: "Quicksand_400Regular", color: colors.secondary },
  location: { fontSize: 13, fontFamily: "Quicksand_400Regular", color: colors.muted },

  // Compatibility card
  compatCard: {
    backgroundColor: "#E6F9F5", borderWidth: 1, borderColor: "#9FE1CB",
    borderRadius: 16, padding: 14, gap: 6,
  },
  compatHeading: { fontSize: 13, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: "#0F6E56" },
  compatLine: { fontSize: 14, fontFamily: "Quicksand_400Regular", color: "#085041", lineHeight: 20 },

  // Sections
  section: { gap: 10 },
  sectionLabel: { fontSize: 10, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.muted, letterSpacing: 1.2 },

  // Pills
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: colors.white, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border,
  },
  pillText: { fontSize: 13, fontWeight: "500", fontFamily: "Quicksand_500Medium", color: colors.foreground },
  pillTeal: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: colors.tintTeal, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.teal,
  },
  pillTealText: { fontSize: 13, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.teal },

  // Prompt cards
  promptCard: {
    backgroundColor: colors.white, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: 14, gap: 4,
  },
  promptQ: { fontSize: 10, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.muted, letterSpacing: 0.8, textTransform: "capitalize" },
  promptA: { fontSize: 15, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.foreground, lineHeight: 20 },

  // Sticky bottom bar
  stickyBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", gap: 10,
    paddingHorizontal: 20, paddingVertical: 16,
    paddingBottom: 32,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  msgBtn: {
    flex: 1, height: 54, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.teal,
    alignItems: "center", justifyContent: "center",
  },
  msgBtnText: {
    fontSize: 15, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.teal,
  },
});

const viewerS = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  handle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginTop: 12 },
  topBar: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 20, paddingTop: 8 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { padding: 24, gap: 20, paddingBottom: 60 },
  heroSection: { alignItems: "center", gap: 6 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surface, marginBottom: 4 },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: colors.tintTeal },
  initials: { fontSize: 32, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.teal },
  name: { fontSize: 22, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground, letterSpacing: -0.4 },
  occupation: { fontSize: 13, fontFamily: "Quicksand_400Regular", color: colors.muted },
  hint: { fontSize: 13, fontFamily: "Quicksand_400Regular", color: colors.muted },
  bioBox: {
    borderLeftWidth: 3, borderLeftColor: colors.teal,
    backgroundColor: "#F0FDFB", borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  bioText: { fontSize: 14, fontStyle: "italic", fontFamily: "Quicksand_400Regular", color: colors.secondary, lineHeight: 20 },
  section: { gap: 10 },
  sectionLabel: { fontSize: 10, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.muted, letterSpacing: 1.2 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: colors.white, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border,
  },
  pillText: { fontSize: 13, fontWeight: "500", fontFamily: "Quicksand_500Medium", color: colors.foreground },
  compatCard: {
    backgroundColor: "#E6F9F5",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#9FE1CB",
    padding: 14,
    marginBottom: 12,
  },
  compatHeading: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Quicksand_600SemiBold",
    color: "#0F6E56",
    marginBottom: 6,
  },
  compatLine: {
    fontSize: 14,
    color: "#085041",
    lineHeight: 20,
  },
  promptCard: {
    backgroundColor: colors.white, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: 14, gap: 4, ...shadows.card,
  },
  promptQ: { fontSize: 10, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.muted, letterSpacing: 0.8, textTransform: "capitalize" },
  promptA: { fontSize: 15, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.foreground, lineHeight: 20 },
});
