import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
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
import { getSunnyResponse } from "../lib/sunny";
import { useAuth } from "../contexts/AuthContext";
import { colors, radius, shadows, gradients } from "../theme";


const calculateAge = (birthday: string | null): number | null => {
  if (!birthday) return null;
  return Math.floor(
    (Date.now() - new Date(birthday).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
};

// ── Mock activity data ───────────────────────────────────────────────────────
const MOCK_ACTIVITIES = [
  {
    id: "a1",
    title: "coffee & catch up at Small World",
    category: "coffee",
    photo: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=500&fit=crop",
    distance: "0.3 mi",
    location: "Nassau St",
    date: "Saturday, April 5",
    time: "10am",
    tags: ["Free", "This Weekend", "Indoors"],
    vibeEmojis: ["☀️ outdoor", "🧋 casual", "👋 first-timers welcome"],
    goingCount: 2,
    goingAvatars: [
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
      "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop&crop=face",
    ],
    vibe: "casual saturday morning with good lattes and better conversation.",
    host: {
      name: "maya", user_id: "mock-host-1",
      photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
      rating: 4.9, bio: "coffee nerd and weekend wanderer",
      activitiesCount: 12, companionsCount: 8,
      sharedInterests: ["coffee", "live music"],
      promptAnswers: [
        { question: "a hill i'd die on", answer: "oat milk is not a personality. but it helps." },
        { question: "my friends would say my green flag is", answer: "i always show up on time and bring snacks." },
      ],
      previousActivities: [
        { title: "morning espresso run", location: "Nassau St", date: "Mar 22", category: "coffee" },
        { title: "jazz at Small World", location: "Nassau St", date: "Mar 15", category: "concerts" },
      ],
    },
  },
  {
    id: "a2",
    title: "sourland mountain ridge hike",
    category: "hiking",
    photo: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&h=500&fit=crop",
    distance: "12 mi",
    location: "Hillsborough",
    date: "Sunday, April 6",
    time: "8:30am",
    tags: ["Outdoors", "This Weekend", "Active"],
    vibeEmojis: ["🥾 outdoors", "🌅 early bird", "🎒 bring layers"],
    goingCount: 5,
    goingAvatars: [
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
      "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop&crop=face",
    ],
    vibe: "early start, always worth it. bring snacks and layers.",
    host: {
      name: "alex", user_id: "mock-host-2",
      photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      rating: 4.8, bio: "trail runner, always chasing sunrise views",
      activitiesCount: 18, companionsCount: 14,
      sharedInterests: ["hiking", "fitness"],
      promptAnswers: [
        { question: "a hill i'd die on", answer: "trekking poles are not optional. they just aren't." },
        { question: "my friends would say my green flag is", answer: "i've never once cancelled a hike because of clouds." },
      ],
      previousActivities: [
        { title: "canal path run", location: "D&R Canal", date: "Mar 29", category: "fitness" },
        { title: "rocky hill loop", location: "Rocky Hill", date: "Mar 8", category: "hiking" },
      ],
    },
  },
  {
    id: "a3",
    title: "saturday farmers market run",
    category: "markets",
    photo: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&h=500&fit=crop",
    distance: "1.1 mi",
    location: "Princeton Farmers Market",
    date: "Saturday, April 5",
    time: "9am",
    tags: ["Free", "This Weekend", "Outdoors"],
    vibeEmojis: ["🧺 outdoors", "☕ casual", "🆓 free"],
    goingCount: 3,
    goingAvatars: [
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    ],
    vibe: "fresh bread, good people. best way to start the weekend.",
    host: {
      name: "sam", user_id: "mock-host-3",
      photo: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop&crop=face",
      rating: 5.0, bio: "farmers market regular, always finds the best stands",
      activitiesCount: 7, companionsCount: 5,
      sharedInterests: ["markets", "coffee"],
      promptAnswers: [
        { question: "a hill i'd die on", answer: "the sourdough from the corner stand is unmatched. fight me." },
        { question: "my friends would say my green flag is", answer: "i always find the most interesting vendor and introduce everyone." },
      ],
      previousActivities: [
        { title: "west side market stroll", location: "West Side", date: "Mar 22", category: "markets" },
        { title: "sunday brunch crawl", location: "Downtown", date: "Mar 9", category: "coffee" },
      ],
    },
  },
  {
    id: "a4",
    title: "live jazz at the blue whale",
    category: "concerts",
    photo: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=800&h=500&fit=crop",
    distance: "3.4 mi",
    location: "Little Tokyo",
    date: "Friday, April 4",
    time: "9pm",
    tags: ["This Week", "Evening", "Indoors"],
    vibeEmojis: ["🎷 live music", "🌙 evening", "👗 come as you are"],
    goingCount: 4,
    goingAvatars: [
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
      "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop&crop=face",
    ],
    vibe: "late-night jazz and good drinks. dress however you want.",
    host: {
      name: "jamie", user_id: "mock-host-4",
      photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
      rating: 4.7, bio: "music lover, always finding the best live shows",
      activitiesCount: 9, companionsCount: 6,
      sharedInterests: ["concerts", "live music"],
      promptAnswers: [
        { question: "a hill i'd die on", answer: "if you're talking during the set, we can't be friends." },
        { question: "my friends would say my green flag is", answer: "i always find the best spot and save you a seat." },
      ],
      previousActivities: [
        { title: "indie night at the echo", location: "Echo Park", date: "Mar 28", category: "concerts" },
        { title: "open mic at the griffith", location: "Griffith Park", date: "Mar 14", category: "concerts" },
      ],
    },
  },
  {
    id: "a5",
    title: "beach volleyball at venice",
    category: "fitness",
    photo: "https://images.unsplash.com/photo-1559308007-a4b81c3c0cf1?w=800&h=500&fit=crop",
    distance: "8.2 mi",
    location: "Venice Beach",
    date: "Sunday, April 6",
    time: "11am",
    tags: ["Outdoors", "Active", "Free"],
    vibeEmojis: ["🏐 active", "🌊 outdoors", "🆓 free"],
    goingCount: 6,
    goingAvatars: [
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
    ],
    vibe: "no experience needed. just show up.",
    host: {
      name: "riley", user_id: "mock-host-5",
      photo: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&h=100&fit=crop&crop=face",
      rating: 4.9, bio: "beach volleyball regular, all skill levels welcome",
      activitiesCount: 22, companionsCount: 17,
      sharedInterests: ["fitness", "outdoors"],
      promptAnswers: [
        { question: "a hill i'd die on", answer: "sunscreen is not optional. i will hand it to you." },
        { question: "my friends would say my green flag is", answer: "i cheer for everyone, even total beginners." },
      ],
      previousActivities: [
        { title: "morning beach run", location: "Venice Beach", date: "Mar 30", category: "fitness" },
        { title: "sunset volleyball", location: "Santa Monica", date: "Mar 16", category: "fitness" },
      ],
    },
  },
];

// ── Mock my posts data ────────────────────────────────────────────────────────
const MOCK_MY_POSTS = [
  {
    id: "mp1",
    title: "morning run at canal",
    photo: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=400&h=300&fit=crop",
    date: "Sunday, April 6",
    pendingRequests: [
      {
        id: "r1",
        name: "sarah",
        photo: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100&h=100&fit=crop&crop=face",
        bio: "runner, coffee lover, outdoor enthusiast",
      },
      {
        id: "r2",
        name: "jordan",
        photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
        bio: "into trail running and weekend adventures",
      },
    ],
  },
  {
    id: "mp2",
    title: "gallery night downtown",
    photo: "https://images.unsplash.com/photo-1541367777708-7905fe3296c0?w=400&h=300&fit=crop",
    date: "Friday, April 4",
    pendingRequests: [
      {
        id: "r3",
        name: "priya",
        photo: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
        bio: "art nerd, always looking for interesting openings",
      },
    ],
  },
  {
    id: "mp3",
    title: "sunday brunch crawl",
    photo: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop",
    date: "Sunday, April 13",
    pendingRequests: [],
  },
];

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
  coffee:   ["#C8956C", "#A0695A"],
  hiking:   ["#5BA85E", "#3D7A40"],
  markets:  ["#E8A838", "#C68A20"],
  concerts: ["#7B5EA7", "#5A3D88"],
  fitness:  ["#4A90D9", "#2D6BB5"],
  sports:   ["#E05C4B", "#B83C2E"],
  default:  ["#2DD4BF", "#3B82F6"],
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
  openPostModal?: boolean;
  onPostModalOpened?: () => void;
}

export const DiscoverScreen = ({ activeTab, onTabPress, onMembershipPress, onMessagesPress, openPostModal, onPostModalOpened }: DiscoverScreenProps) => {
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
  const [toggleY, setToggleY] = useState(120);
  const hasUnread = false;

  // Sunny dynamic copy
  const [sunnyDeckDoneDesc, setSunnyDeckDoneDesc] = useState("check back tomorrow or post your own.");
  useEffect(() => {
    getSunnyResponse({ context: "emptyDiscover" }).then(setSunnyDeckDoneDesc);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("walkthrough_complete").then(val => {
      if (!val) setShowWalkthrough(true);
    });
  }, []);

  const { tier, isLimited, incrementImIn } = useMembershipTier();

  const [requestedSet, setRequestedSet] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showUpsell, setShowUpsell] = useState(false);
  const [showRequestSheet, setShowRequestSheet] = useState(false);
  const [requestSheetActivity, setRequestSheetActivity] = useState<typeof MOCK_MY_POSTS[0] | null>(null);
  const [myPostsState, setMyPostsState] = useState(MOCK_MY_POSTS);

  // Live activity data
  const [liveActivities, setLiveActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
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
  const [postDesc, setPostDesc] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [showHostProfile, setShowHostProfile] = useState(false);
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());

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
    const activity = MOCK_ACTIVITIES.find(a => a.id === id);
    if (activity) {
      AsyncStorage.getItem("saved_activities_meta").then(val => {
        const existing = val ? JSON.parse(val) : {};
        existing[id] = { title: activity.title, date: activity.date, host: activity.host.name, category: activity.category };
        AsyncStorage.setItem("saved_activities_meta", JSON.stringify(existing));
      });
    }
  };
  const [profileActivity, setProfileActivity] = useState<typeof MOCK_ACTIVITIES[0] | null>(null);

  // I'm In celebration modal
  const [showCelebModal, setShowCelebModal] = useState(false);
  const [celebData, setCelebData] = useState<{ title: string; subtitle: string; onDone: () => void } | null>(null);

  const showImInToast = (title: string, subtitle: string, onDone: () => void) => {
    setCelebData({ title, subtitle, onDone });
    setShowCelebModal(true);
  };

  const handleCelebrationDismiss = () => {
    setShowCelebModal(false);
    celebData?.onDone();
    setCelebData(null);
  };

  // Approved counts per post for tier enforcement
  const [approvedCounts, setApprovedCounts] = useState<Record<string, number>>({});
  const getApprovalLimit = () => {
    if (tier === "trail") return Infinity;
    if (tier === "go") return 5;
    return 1; // free
  };

  // Fetch live browse activities
  useEffect(() => {
    if (discoverMode !== "browse") return;
    let cancelled = false;
    setLoadingActivities(true);
    supabase
      .from("activities")
      .select("*, profiles!user_id(first_name, avatar_url)")
      .eq("status", "active")
      .gte("activity_date", new Date().toISOString().split("T")[0])
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data && data.length > 0) {
          setLiveActivities(data.map((a: any) => ({
            id: a.id,
            title: a.title,
            category: a.tags?.[0] ?? "default",
            photo: FALLBACK_PHOTOS[a.tags?.[0]] ?? FALLBACK_PHOTOS.default,
            distance: "",
            location: a.location_name ?? "",
            date: a.activity_date ?? "",
            time: a.activity_time ?? "",
            tags: a.tags ?? [],
            vibeEmojis: [],
            goingCount: 0,
            goingAvatars: [],
            vibe: a.description ?? "",
            host: {
              name: a.profiles?.first_name ?? "someone",
              user_id: a.user_id,
              photo: a.profiles?.avatar_url ?? "",
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
      });
    return () => { cancelled = true; };
  }, [discoverMode]);

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
    if (myActivityTab === "saved" && discoverMode === "myActivity") {
      fetchSaved();
    }
  }, [myActivityTab, discoverMode]);

  // Reset deck index when filter or mode changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [activeFilter, discoverMode]);

  const deck = (() => {
    const source = liveActivities.length > 0 ? liveActivities : MOCK_ACTIVITIES;
    return activeFilter === "all" ? source : source.filter((a: any) => a.category === activeFilter);
  })();

  const handleImIn = async (activityId: string) => {
    if (isLimited) {
      setShowUpsell(true);
      return;
    }
    const source = liveActivities.length > 0 ? liveActivities : MOCK_ACTIVITIES;
    const act = source.find((a: any) => a.id === activityId);
    // SUPABASE: Ensure join_requests table exists:
    // CREATE TABLE IF NOT EXISTS join_requests (
    //   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    //   activity_id uuid REFERENCES activities(id) ON DELETE CASCADE,
    //   requester_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    //   status text DEFAULT 'pending',
    //   created_at timestamptz DEFAULT now()
    // );
    // Enable RLS and add policy: allow insert for authenticated users where requester_id = auth.uid()
    if (user) {
      const { error } = await supabase.from("join_requests").insert({
        activity_id: activityId,
        requester_id: user.id,
        status: "pending",
      } as any);
      if (error) {
        console.warn("join_requests insert failed:", error.message);
      }
    }
    await incrementImIn();
    setRequestedSet(prev => new Set([...prev, activityId]));
    const hostName = act?.host.name ?? "them";
    const actTitle = act?.title ?? "the activity";
    const subtitle = await getSunnyResponse({
      context: "imIn",
      activityTitle: actTitle,
      hostName,
    });
    showImInToast(
      "you're in!",
      subtitle,
      () => setCurrentIndex(prev => prev + 1),
    );
  };

  const handleSkip = () => {
    setCurrentIndex(prev => prev + 1);
  };

  const handleMaybeLater = async () => {
    if (!currentCard) return;
    try {
      if (user) {
        await supabase.from("activity_interactions").insert({
          activity_id: currentCard.id,
          user_id: user.id,
          action: "save",
        });
      }
    } catch {
      // non-blocking
    }
    showToast("saved to your private list.");
    setCurrentIndex(prev => prev + 1);
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
    } catch {
      // non-blocking
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
    console.log("DATE BEING SENT:", formattedDate, typeof formattedDate);
    setIsPosting(true);
    try {
      const { data, error } = await supabase.from("activities").insert({
        user_id: user?.id,
        title: postTitle.trim(),
        description: postDesc.trim() || null,
        activity_date: formattedDate,
        activity_time: selectedTime
          ? selectedTime.toTimeString().split(" ")[0]
          : null,
        location_name: postLocation.trim() || null,
        tags: finalCategory ? [finalCategory] : [],
        max_participants: postSpots,
        is_group: postSpots > 1,
        status: "active",
      }).select().single();
      if (error) {
        console.error("post creation error:", JSON.stringify(error));
        showToast("something went wrong. try again?");
        return;
      }
      console.log("post created:", data);
      setShowPostModal(false);
      setPostTitle("");
      setSelectedDate(new Date());
      setSelectedTime(null);
      setPostSelectedCategory("");
      setPostCustomCategory("");
      setPostLocation("");
      setPostDesc("");
      setPostSpots(1);
      setShowGroupNudge(false);
      showToast("posted! check back soon.");
    } catch (err) {
      console.error("post creation exception:", err);
      showToast("something went wrong. try again?");
    } finally {
      setIsPosting(false);
    }
  };

  const currentCard = deck[currentIndex];
  const isDone = currentIndex >= deck.length;
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "good morning" : hour < 17 ? "good afternoon" : "good evening";
  const photoUri = currentCard
    ? (currentCard.photo && currentCard.photo.startsWith("http") ? currentCard.photo : (FALLBACK_PHOTOS[currentCard.category] || FALLBACK_PHOTOS.default))
    : "";

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
            <Text style={{ fontSize: 11, color: colors.muted, paddingHorizontal: 16, paddingBottom: 4 }}>
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
                      <View style={s.requestBadge}>
                        <Text style={s.requestBadgeText}>{post.pendingRequests.length} wants to tandem</Text>
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
              <FlatList
                data={savedActivities}
                keyExtractor={act => act.id}
                scrollEnabled={false}
                contentContainerStyle={{ gap: 12 }}
                renderItem={({ item: act }) => (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => showToast("you saved this one.")}
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
                )}
              />
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
          ) : (
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
                    {/* Full-bleed photo with category pill overlay */}
                    <View style={s.photoWrap}>
                      <Image source={{ uri: photoUri }} style={s.cardPhoto} resizeMode="cover" />
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
                  </View>
                </View>
              </ScrollView>

              {/* Action buttons — pinned below card */}
              <View style={[s.actionRow, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
                {requestedSet.has(currentCard.id) ? (
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
              <Text style={notifS.title}>notifications</Text>
              <Ionicons name="notifications-outline" size={22} color={colors.teal} />
            </View>
            <TouchableOpacity onPress={() => setShowNotifications(false)} style={notifS.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <View style={notifS.empty}>
            <SunnyAvatar expression="warm" size={60} />
            <Text style={notifS.emptyTitle}>nothing yet.</Text>
            <Text style={notifS.emptyDesc}>notifications are on their way. for now, sunny's keeping an eye on things.</Text>
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
            <TouchableOpacity
              onPress={() => { handleCelebrationDismiss(); setDiscoverMode("myActivity"); }}
              style={{ paddingTop: 12, paddingBottom: 4 }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center" }}>
                see your pending requests →
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Post Activity Modal */}
      <Modal visible={showPostModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPostModal(false)}>
        <KeyboardAvoidingView style={modalS.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
                  onPress={() => { setPostSelectedCategory(prev => prev === c.key ? "" : c.key); if (c.key !== "other") setPostCustomCategory(""); }}
                  activeOpacity={0.8}
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
                onValueChange={(_, date) => { setShowDatePicker(false); setSelectedDate(date); }}
                onDismiss={() => setShowDatePicker(false)}
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
                onValueChange={(_, time) => { setShowTimePicker(false); setSelectedTime(time); }}
                onDismiss={() => setShowTimePicker(false)}
              />
            )}

            <View style={modalS.locationField}>
              <Ionicons name="location-outline" size={15} color={colors.teal} />
              <TextInput
                style={[modalS.pillFieldText, { flex: 1 }]}
                placeholder="where is it?"
                placeholderTextColor={colors.muted}
                value={postLocation}
                onChangeText={setPostLocation}
              />
            </View>

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
              onPress={handleSubmitPost}>
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={modalS.postBtnInner}>
                <Text style={modalS.postBtnText}>post it →</Text>
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
          return (
            <View style={hostS.container}>
              {/* Handle + close */}
              <View style={hostS.handle} />
              <View style={hostS.topBar}>
                <TouchableOpacity onPress={() => setShowHostProfile(false)} style={hostS.closeBtn} activeOpacity={0.7}>
                  <Ionicons name="close" size={20} color={colors.muted} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={hostS.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Avatar + name + location */}
                <View style={hostS.heroSection}>
                  <Image source={{ uri: host.photo }} style={hostS.avatar} />
                  <Text style={hostS.name}>{host.name}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <Ionicons name="location-outline" size={13} color={colors.muted} />
                    <Text style={hostS.location}>{profileActivity.location}</Text>
                  </View>
                </View>

                {/* Bio quote */}
                <Text style={hostS.bio}>"{host.bio}"</Text>

                {/* Stat pills */}
                <View style={hostS.statsRow}>
                  <View style={hostS.statPill}>
                    <Text style={hostS.statNum}>{host.activitiesCount}</Text>
                    <Text style={hostS.statLabel}>activities</Text>
                  </View>
                  <View style={hostS.statPill}>
                    <Text style={hostS.statNum}>{host.companionsCount}</Text>
                    <Text style={hostS.statLabel}>companions</Text>
                  </View>
                </View>

                {/* Shared interests */}
                {host.sharedInterests && host.sharedInterests.length > 0 && (
                  <View style={hostS.section}>
                    <Text style={hostS.sectionLabel}>we're both into...</Text>
                    <View style={hostS.interestRow}>
                      {host.sharedInterests.map((interest) => (
                        <LinearGradient
                          key={interest}
                          colors={gradients.brand}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={hostS.interestPill}
                        >
                          <Ionicons
                            name={(CATEGORY_ICON[interest] || CATEGORY_ICON.default) as any}
                            size={12}
                            color={colors.white}
                          />
                          <Text style={hostS.interestText}>{interest}</Text>
                        </LinearGradient>
                      ))}
                    </View>
                  </View>
                )}

                {/* Previous activities */}
                {host.previousActivities && host.previousActivities.length > 0 && (
                  <View style={hostS.section}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={hostS.sectionLabel}>previous activities</Text>
                      <TouchableOpacity activeOpacity={0.7}>
                        <Text style={hostS.viewAll}>view all</Text>
                      </TouchableOpacity>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 12, paddingRight: 4 }}
                    >
                      {host.previousActivities.map((act, i) => (
                        <View key={i} style={hostS.prevCard}>
                          <LinearGradient
                            colors={CATEGORY_GRADIENT[act.category] || CATEGORY_GRADIENT.default}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={hostS.prevCardBlock}
                          >
                            <Ionicons
                              name={(CATEGORY_ICON[act.category] || CATEGORY_ICON.default) as any}
                              size={24}
                              color={colors.white}
                            />
                          </LinearGradient>
                          <Text style={hostS.prevCardTitle} numberOfLines={2}>{act.title}</Text>
                          <Text style={hostS.prevCardMeta}>{act.location} · {act.date}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </ScrollView>

              {/* Sticky bottom bar */}
              <View style={hostS.stickyBar}>
                <TouchableOpacity
                  style={hostS.msgBtn}
                  activeOpacity={0.8}
                  onPress={() => {
                    // TODO: wire to messages table — check for existing convo between
                    // user and host, create one if none exists, navigate to that chat.
                    setShowHostProfile(false);
                    if (onMessagesPress) {
                      onMessagesPress();
                    } else {
                      showToast("messaging coming soon.");
                    }
                  }}
                >
                  <Text style={hostS.msgBtnText}>say hey 👋</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}
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
            {(requestSheetActivity?.pendingRequests.length ?? 0) === 0 ? (
              <View style={reqS.empty}>
                <SunnyAvatar expression="warm" size={56} />
                <Text style={reqS.emptyTitle}>no pending requests.</Text>
                <Text style={reqS.emptyDesc}>when someone wants in, they'll show up here.</Text>
              </View>
            ) : (
              requestSheetActivity?.pendingRequests.map(req => {
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
                          <Text style={reqS.letInBtnText}>let them in</Text>
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
  greeting: { fontSize: 12, color: colors.muted, fontWeight: "500" },
  headerTitle: { fontSize: 26, fontWeight: "800", color: colors.foreground, letterSpacing: -0.5 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.tintTeal, alignItems: "center", justifyContent: "center" },
  iconBadge: { position: "absolute", top: 7, right: 7, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.teal, borderWidth: 1.5, borderColor: colors.background },
  avatarBtn: {},
  avatarRing: { width: 38, height: 38, borderRadius: 19, padding: 2 },
  avatarInner: { flex: 1, borderRadius: 17, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },

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
  modeActiveText: { fontSize: 13, fontWeight: "700", color: colors.white },
  modeInactive: { paddingVertical: 8, alignItems: "center" },
  modeInactiveText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },

  // Filter pills
  filtersScroll: { flexGrow: 0 },
  filtersContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, flexDirection: "row" },
  filterPill: {
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: colors.white, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border,
  },
  filterPillActive: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.full },
  filterText: { fontSize: 13, fontWeight: "600", color: colors.foreground },
  filterTextActive: { fontSize: 13, fontWeight: "700", color: colors.white },

  // Feed (My Activity tab)
  feed: { flex: 1 },
  feedContent: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },

  // My Activity empty state
  myActivityEmpty: { alignItems: "center", paddingTop: 80, gap: 12 },
  myActivityEmptyTitle: { fontSize: 18, fontWeight: "700", color: colors.foreground },
  myActivityEmptyDesc: { fontSize: 14, color: colors.muted, textAlign: "center", maxWidth: 260, lineHeight: 20 },

  // My posts list
  myPostRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.white, borderRadius: radius.md,
    padding: 12, ...shadows.card,
  },
  myPostPhoto: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surface },
  myPostInfo: { flex: 1, gap: 3 },
  myPostTitle: { fontSize: 15, fontWeight: "700", color: colors.foreground, letterSpacing: -0.2 },
  myPostDate: { fontSize: 12, color: colors.muted },
  requestBadge: {
    backgroundColor: colors.tintTeal, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  requestBadgeText: { fontSize: 11, fontWeight: "700", color: colors.teal },

  // Card deck
  deckContainer: { flex: 1, paddingHorizontal: 16, paddingBottom: 80 },
  deckProgress: { fontSize: 12, color: colors.muted, paddingTop: 10, paddingBottom: 6 },
  deckDone: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingBottom: 80 },
  deckDoneTitle: { fontSize: 18, fontWeight: "700", color: colors.foreground, textAlign: "center" },
  deckDoneDesc: { fontSize: 14, color: colors.muted, textAlign: "center", maxWidth: 260, lineHeight: 20 },

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
  savedPillText: { fontSize: 11, fontWeight: "600", color: colors.teal },
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
  categoryPillText: { fontSize: 11, fontWeight: "700", color: colors.foreground },
  featuredBadge: {
    position: "absolute", top: 12, right: 12,
    borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4,
  },
  featuredBadgeText: { fontSize: 10, fontWeight: "700", color: colors.white },

  cardBody: { padding: 20, gap: 0 },
  cardTitle: { fontSize: 20, fontWeight: "700", color: colors.foreground, letterSpacing: -0.3, marginBottom: 12 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardMetaTeal: { fontSize: 13, color: colors.teal, fontWeight: "600" },
  cardMetaGray: { fontSize: 13, color: colors.muted },
  vibeBox: {
    borderLeftWidth: 3, borderLeftColor: colors.teal,
    backgroundColor: "#F0FDFB", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  vibeText: { fontSize: 14, fontStyle: "italic", color: colors.secondary, lineHeight: 20 },

  // Attendee row
  goingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatarStack: { flexDirection: "row" },
  stackAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: colors.white, backgroundColor: colors.surface },
  goingText: { fontSize: 12, color: colors.muted, fontWeight: "500" },

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
  hostStripLabel: { fontSize: 13, color: colors.muted },
  hostStripName: { fontWeight: "700", color: colors.foreground },
  hostStripBio: { fontSize: 11, fontStyle: "italic", color: colors.muted, marginTop: 1 },
  viewProfile: { fontSize: 13, fontWeight: "600", color: colors.teal },

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
  passBtnText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
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
  imInBtnText: { fontSize: 15, fontWeight: "700", color: colors.white },
  requestedBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  requestedBtnText: { fontSize: 15, fontWeight: "600", color: colors.muted },

  // Vibe emoji tag pills
  vibeTagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  vibeTagPill: {
    backgroundColor: colors.white, borderRadius: radius.full,
    borderWidth: 1, borderColor: "#E5E7EB",
    paddingHorizontal: 8, paddingVertical: 6,
  },
  vibeTagText: { fontSize: 12, color: colors.foreground },

  // Prompt answer cards (on card)
  promptCard: {
    backgroundColor: "#FAFAFA", borderRadius: 10,
    borderWidth: 1, borderColor: "#E5E7EB",
    padding: 12, gap: 4,
  },
  promptCardQ: { fontSize: 10, fontWeight: "700", color: "#9CA3AF", letterSpacing: 0.8, textTransform: "uppercase" },
  promptCardA: { fontSize: 14, fontWeight: "600", color: colors.foreground, lineHeight: 20 },

  // Toast
  toast: {
    position: "absolute", bottom: 100, alignSelf: "center",
    backgroundColor: "rgba(15,23,42,0.85)", borderRadius: radius.full,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  toastText: { fontSize: 13, color: colors.white, fontWeight: "500" },

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
  lockedFilterText: { fontSize: 11, fontWeight: "600", color: colors.teal },
});

const notifS = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  handle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginTop: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 22, fontWeight: "800", color: colors.foreground, letterSpacing: -0.5 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingBottom: 80 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.foreground },
  emptyDesc: { fontSize: 14, color: colors.muted, textAlign: "center", maxWidth: 260, lineHeight: 20 },
});

const filterS = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  handle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginTop: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 22, fontWeight: "800", color: colors.foreground, letterSpacing: -0.5 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  resetText: { fontSize: 14, fontWeight: "600", color: colors.teal },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 6, paddingBottom: 24 },
  sectionLabel: { fontSize: 10, fontWeight: "700", color: colors.muted, letterSpacing: 1.2, marginTop: 16, marginBottom: 10 },
  lockedSectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, marginBottom: 10 },
  goBadge: { backgroundColor: colors.tintTeal, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  goBadgeText: { fontSize: 11, fontWeight: "700", color: colors.teal },

  // Pill rows (free)
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.full, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border },
  pillText: { fontSize: 13, fontWeight: "500", color: colors.foreground },
  pillActive: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.full },
  pillActiveText: { fontSize: 13, fontWeight: "700", color: colors.white },

  // Locked pills
  pillLocked: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, opacity: 0.7,
  },
  pillLockedText: { fontSize: 13, fontWeight: "500", color: colors.muted },

  // Age stepper
  ageRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  ageStepper: { flex: 1, alignItems: "center", gap: 6 },
  ageLabel: { fontSize: 11, fontWeight: "700", color: colors.muted, letterSpacing: 0.8 },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  stepBtnText: { fontSize: 20, fontWeight: "300", color: colors.foreground, lineHeight: 24 },
  stepValue: { fontSize: 20, fontWeight: "700", color: colors.foreground, minWidth: 32, textAlign: "center" },
  ageDash: { fontSize: 18, color: colors.muted, paddingTop: 20 },

  // Footer
  footer: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  applyBtn: { height: 52, borderRadius: radius.full, overflow: "hidden", ...shadows.brand },
  applyBtnInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  applyBtnText: { fontSize: 15, fontWeight: "700", color: colors.white },
  optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  optionSelected: { borderColor: colors.teal, backgroundColor: colors.tintTeal },
  optionText: { fontSize: 13, fontWeight: "600", color: colors.secondary },
  optionTextSelected: { color: colors.teal },
});

const modalS = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  handle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginTop: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 18, fontWeight: "700", color: colors.foreground },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 16, paddingBottom: 80 },
  heroInput: {
    fontSize: 20, fontWeight: "700", color: colors.foreground,
    borderBottomWidth: 2, borderBottomColor: colors.border,
    paddingBottom: 12, paddingTop: 4,
    minHeight: 50,
  },
  sectionLabel: { fontSize: 10, fontWeight: "700", color: colors.muted, letterSpacing: 1.2 },
  categoryScroll: { flexGrow: 0 },
  categoryRow: { flexDirection: "row", gap: 10 },
  categoryTile: {
    width: 80, paddingVertical: 12, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white,
    alignItems: "center", gap: 6,
  },
  categoryEmoji: { fontSize: 22 },
  categoryLabel: { fontSize: 11, fontWeight: "600", color: colors.foreground },
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
  pillFieldText: { fontSize: 14, color: colors.muted, fontWeight: "500" },
  spotsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  spotsLabel: { fontSize: 14, fontWeight: "600", color: colors.foreground },
  spotsControls: { flexDirection: "row", alignItems: "center", gap: 16 },
  spotsBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  spotsBtnText: { fontSize: 18, fontWeight: "300", color: colors.foreground, lineHeight: 22 },
  spotsNum: { fontSize: 18, fontWeight: "700", color: colors.foreground, minWidth: 24, textAlign: "center" },
  spotsGroupHint: { fontSize: 11, color: colors.teal, fontWeight: "600", marginTop: 2 },
  spotsBtnPlus: { width: 32, height: 32, borderRadius: 16, overflow: "hidden" },
  spotsBtnPlusInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  spotsBtnPlusText: { fontSize: 18, fontWeight: "300", color: colors.white, lineHeight: 22 },
  groupRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  groupLabel: { fontSize: 14, fontWeight: "600", color: colors.foreground },
  descInput: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: colors.foreground, minHeight: 80,
    textAlignVertical: "top",
  },
  postBtn: { height: 52, borderRadius: radius.full, overflow: "hidden", ...shadows.brand },
  postBtnInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  postBtnText: { fontSize: 15, fontWeight: "700", color: colors.white },
  groupNudge: {
    flexDirection: "row", flexWrap: "wrap", alignItems: "center",
    backgroundColor: "#F0FDFB", borderRadius: 8,
    borderLeftWidth: 3, borderLeftColor: colors.teal,
    paddingHorizontal: 12, paddingVertical: 10,
    marginTop: -8,
  },
  groupNudgeText: { fontSize: 13, color: colors.muted },
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
  dateFieldHint: { fontSize: 12, color: colors.muted },
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
  title: { fontSize: 22, fontWeight: "800", color: colors.foreground, textAlign: "center", marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20, marginBottom: 16 },
  keepGoingBtn: { width: "100%", height: 52, borderRadius: 26, overflow: "hidden" },
  keepGoingInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  keepGoingText: { fontSize: 15, fontWeight: "700", color: colors.white },
});

const reqS = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  handle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginTop: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 18, fontWeight: "700", color: colors.foreground, flex: 1, marginRight: 12 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 40 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.foreground },
  emptyDesc: { fontSize: 14, color: colors.muted, textAlign: "center", maxWidth: 260, lineHeight: 20 },
  requesterRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.white, borderRadius: radius.md,
    padding: 14, ...shadows.card,
  },
  requesterAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface },
  requesterInfo: { flex: 1, gap: 2 },
  requesterName: { fontSize: 15, fontWeight: "700", color: colors.foreground },
  requesterBio: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  requesterActions: { flexDirection: "column", gap: 6, alignItems: "flex-end" },
  letInBtn: {
    backgroundColor: colors.teal, borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  letInBtnText: { fontSize: 12, fontWeight: "700", color: colors.white },
  passBtn: {
    backgroundColor: colors.white, borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1.5, borderColor: colors.border,
  },
  passBtnText: { fontSize: 12, fontWeight: "600", color: colors.muted },
  letInBtnLocked: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.surface, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.border, opacity: 0.6,
  },
  letInBtnLockedText: { fontSize: 11, fontWeight: "700", color: colors.muted },
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
  name: { fontSize: 22, fontWeight: "700", color: colors.foreground, letterSpacing: -0.4 },
  location: { fontSize: 13, color: colors.muted },
  ratingText: { fontSize: 13, color: colors.muted, fontWeight: "500" },

  // Bio
  bio: {
    fontStyle: "italic", color: colors.muted,
    textAlign: "center", fontSize: 14, lineHeight: 20,
  },

  // Stats
  statsRow: { flexDirection: "row", justifyContent: "center", gap: 12 },
  statPill: {
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: colors.white, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
    alignItems: "center", gap: 2,
  },
  statNum: { fontSize: 18, fontWeight: "700", color: colors.foreground },
  statLabel: { fontSize: 11, color: colors.muted, fontWeight: "500" },

  // Sections
  section: { gap: 12 },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: colors.foreground, letterSpacing: -0.2 },

  // Shared interests
  interestRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  interestPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full,
  },
  interestText: { fontSize: 13, fontWeight: "600", color: colors.white },

  // Previous activities
  viewAll: { fontSize: 13, fontWeight: "600", color: colors.teal },
  prevCard: { width: 140 },
  prevCardBlock: {
    height: 90, borderRadius: radius.md,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  prevCardTitle: { fontSize: 13, fontWeight: "600", color: colors.foreground, lineHeight: 17 },
  prevCardMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },

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
    fontSize: 15, fontWeight: "700", color: colors.teal,
  },
});
