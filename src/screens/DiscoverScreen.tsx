import React, { useState, useRef, useEffect } from "react";
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
  Switch,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BottomNav } from "../components/BottomNav";
import SunnyAvatar from "../components/SunnyAvatar";
import { UpsellSheet } from "../components/UpsellSheet";
import { PremiumLock } from "../components/PremiumLock";
import { useMembershipTier } from "../hooks/useMembershipTier";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { colors, radius, shadows, gradients } from "../theme";


// Dimensions imported for future use

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
    goingCount: 2,
    goingAvatars: [
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
      "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop&crop=face",
    ],
    vibe: "casual saturday morning with good lattes and better conversation.",
    host: { name: "maya", user_id: "mock-host-1", photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face" },
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
    goingCount: 5,
    goingAvatars: [
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
      "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop&crop=face",
    ],
    vibe: "early start, always worth it. bring snacks and layers.",
    host: { name: "alex", user_id: "mock-host-2", photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face" },
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
    goingCount: 3,
    goingAvatars: [
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    ],
    vibe: "fresh bread, good people. best way to start the weekend.",
    host: { name: "sam", user_id: "mock-host-3", photo: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop&crop=face" },
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
    goingCount: 4,
    goingAvatars: [
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
      "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop&crop=face",
    ],
    vibe: "late-night jazz and good drinks. dress however you want.",
    host: { name: "jamie", user_id: "mock-host-4", photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face" },
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
    goingCount: 6,
    goingAvatars: [
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
    ],
    vibe: "no experience needed. just show up.",
    host: { name: "riley", user_id: "mock-host-5", photo: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&h=100&fit=crop&crop=face" },
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

const CATEGORY_EMOJI: Record<string, string> = {
  coffee: "☕", hiking: "🥾", markets: "🛍", concerts: "🎵", fitness: "💪", sports: "🏃",
};

const FILTERS = [
  { key: "all",      label: "all",       emoji: "" },
  { key: "coffee",   label: "coffee",    emoji: "☕" },
  { key: "hiking",   label: "hiking",    emoji: "🥾" },
  { key: "markets",  label: "markets",   emoji: "🛍" },
  { key: "concerts", label: "concerts",  emoji: "🎵" },
  { key: "fitness",  label: "fitness",   emoji: "💪" },
  { key: "sports",   label: "sports",    emoji: "🏃" },
];


interface DiscoverScreenProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
  onMessagesPress?: () => void;
  onMembershipPress?: () => void;
}

export const DiscoverScreen = ({ activeTab, onTabPress, onMembershipPress }: DiscoverScreenProps) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const rawName = user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email?.split("@")[0] || "there";
  const firstName = rawName.split(/[\s._\-@]/)[0].replace(/[^a-zA-Z]/g, "").toLowerCase() || "there";
  const [discoverMode, setDiscoverMode] = useState<"browse" | "myActivity">("browse");
  const [activeFilter, setActiveFilter] = useState("all");
  const [showNotifications, setShowNotifications] = useState(false);
  const hasUnread = false;

  const { tier, isLimited, incrementImIn } = useMembershipTier();

  const [requestedSet, setRequestedSet] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showUpsell, setShowUpsell] = useState(false);
  const [showRequestSheet, setShowRequestSheet] = useState(false);
  const [requestSheetActivity, setRequestSheetActivity] = useState<typeof MOCK_MY_POSTS[0] | null>(null);
  const [myPostsState, setMyPostsState] = useState(MOCK_MY_POSTS);

  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  };
  const [showPostModal, setShowPostModal] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [, setCelebrationName] = useState("");
  const [, setSelectedGenders] = useState<string[]>([]);
  const [selectedDistance, setSelectedDistance] = useState<string | null>(null);
  const [isGroupActivity, setIsGroupActivity] = useState(false);
  const [showGroupUpsell, setShowGroupUpsell] = useState(false);

  // Reset deck index when filter or mode changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [activeFilter, discoverMode]);

  const filteredActivities = activeFilter === "all"
    ? MOCK_ACTIVITIES
    : MOCK_ACTIVITIES.filter(a => a.category === activeFilter);

  const handleCelebrationDismiss = () => {
    setShowCelebration(false);
    setCurrentIndex(prev => prev + 1);
  };

  const handleImIn = async (activityId: string) => {
    if (isLimited) {
      setShowUpsell(true);
      return;
    }
    const act = MOCK_ACTIVITIES.find(a => a.id === activityId);
    try {
      if (user) {
        await supabase.from("join_requests").insert({
          activity_id: activityId,
          requester_id: user.id,
          status: "pending",
        } as any);
      }
    } catch {
      // join_requests table may not exist yet
    }
    await incrementImIn();
    setRequestedSet(prev => new Set([...prev, activityId]));
    setCelebrationName(act?.host.name ?? "");
    setShowCelebration(true);
  };

  const handleSkip = () => {
    setCurrentIndex(prev => prev + 1);
  };

  // My Activity — request sheet handlers
  const handleLetIn = (postId: string, requesterId: string, requesterName: string, activityTitle: string) => {
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
    showToast(`you added ${requesterName} to ${activityTitle}.`);
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
    showToast("got it.");
  };

  // Deck
  const deck = filteredActivities;
  const currentCard = deck[currentIndex];
  const isDone = currentIndex >= deck.length;
  const photoUri = currentCard
    ? (currentCard.photo && currentCard.photo.startsWith("http") ? currentCard.photo : (FALLBACK_PHOTOS[currentCard.category] || FALLBACK_PHOTOS.default))
    : "";

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <View style={s.headerLeft}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={s.greeting}>good morning, {firstName} </Text>
            <Text style={[s.greeting, { fontFamily: 'System' }]}>👋</Text>
          </View>
          <Text style={s.headerTitle}>discover</Text>
        </View>
        <View style={s.headerRight}>
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
      <View style={s.modeToggleRow}>
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
                    {f.emoji ? <Text style={{ fontFamily: 'System', fontSize: 13 }}>{f.emoji}</Text> : null}
                    <Text style={s.filterTextActive}>{f.label}</Text>
                  </View>
                </LinearGradient>
              ) : (
                <View style={s.filterPill}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    {f.emoji ? <Text style={{ fontFamily: 'System', fontSize: 13 }}>{f.emoji}</Text> : null}
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
                    <Text style={s.requestBadgeText}>{post.pendingRequests.length} requests</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      ) : (
        /* ── Browse Tab — Card Deck ── */
        <View style={s.deckContainer}>
          {/* Progress indicator */}
          {!isDone && deck.length > 0 && (
            <Text style={s.deckProgress}>{currentIndex + 1} of {deck.length} nearby</Text>
          )}

          {isDone || deck.length === 0 ? (
            <View style={s.deckDone}>
              <SunnyAvatar expression="warm" size={64} />
              <Text style={s.deckDoneTitle}>that's everyone nearby for now.</Text>
              <Text style={s.deckDoneDesc}>check back tomorrow or post your own.</Text>
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
                  <View style={s.card}>
                    {/* Photo with category pill overlay */}
                    <View style={s.photoWrap}>
                      <Image source={{ uri: photoUri }} style={s.cardPhoto} resizeMode="cover" />
                      {CATEGORY_EMOJI[currentCard.category] && (
                        <View style={s.categoryPill}>
                          <Text style={{ fontFamily: 'System', fontSize: 13 }}>{CATEGORY_EMOJI[currentCard.category]}</Text>
                          <Text style={s.categoryPillText}>{currentCard.category}</Text>
                        </View>
                      )}
                      {/* Trail featured badge */}
                      {tier === "trail" && (
                        <LinearGradient
                          colors={gradients.brand}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={s.featuredBadge}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                            <Text style={{ fontFamily: 'System', fontSize: 10, color: colors.white }}>✨</Text>
                            <Text style={s.featuredBadgeText}>featured</Text>
                          </View>
                        </LinearGradient>
                      )}
                    </View>

                    {/* Body */}
                    <View style={s.cardBody}>
                      <Text style={s.cardTitle}>{currentCard.title}</Text>

                      <View style={s.cardMeta}>
                        <Ionicons name="location" size={13} color={colors.teal} />
                        <Text style={s.cardMetaTeal}>{currentCard.distance} · {currentCard.location}</Text>
                      </View>

                      <View style={s.cardMeta}>
                        <Ionicons name="calendar-outline" size={13} color={colors.muted} />
                        <Text style={s.cardMetaGray}>{currentCard.date} · {currentCard.time}</Text>
                      </View>

                      {currentCard.vibe ? (
                        <View style={s.vibeBox}>
                          <Text style={s.vibeText}>"{currentCard.vibe}"</Text>
                        </View>
                      ) : null}

                      {/* Going row */}
                      <View style={s.cardFooter}>
                        <View style={s.goingRow}>
                          <View style={s.avatarStack}>
                            {currentCard.goingAvatars.slice(0, 3).map((uri, i) => (
                              <Image
                                key={i}
                                source={{ uri }}
                                style={[s.stackAvatar, { marginLeft: i === 0 ? 0 : -8, zIndex: 3 - i }]}
                              />
                            ))}
                          </View>
                          <Text style={s.goingText}>{currentCard.goingCount} going</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Host strip — below the card */}
                  <View style={s.hostStrip}>
                    <Image source={{ uri: currentCard.host.photo }} style={s.hostStripAvatar} />
                    <Text style={s.hostStripText}>hosted by <Text style={s.hostStripName}>{currentCard.host.name}</Text></Text>
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
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => showToast("saved for later.")} activeOpacity={0.8}>
                      <View style={s.passBtn}>
                        <Text style={s.passBtnText}>later</Text>
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
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                          <Text style={s.imInBtnText}>i'm in</Text>
                          <Text style={{ fontFamily: 'System', fontSize: 14, color: colors.white }}>✨</Text>
                        </View>
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

      <BottomNav
        activeTab={activeTab}
        onTabPress={onTabPress}
        onPostPress={() => setShowPostModal(true)}
      />

      {/* Notifications Modal */}
      <Modal visible={showNotifications} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowNotifications(false)}>
        <View style={notifS.container}>
          <View style={notifS.handle} />
          <View style={notifS.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={notifS.title}>notifications</Text>
              <Text style={{ fontFamily: 'System', fontSize: 22 }}>🔔</Text>
            </View>
            <TouchableOpacity onPress={() => setShowNotifications(false)} style={notifS.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <View style={notifS.empty}>
            <SunnyAvatar expression="warm" size={60} />
            <Text style={notifS.emptyTitle}>all caught up.</Text>
            <Text style={notifS.emptyDesc}>sunny will let you know when someone joins your activity.</Text>
          </View>
        </View>
      </Modal>

      {/* Filter Sheet */}
      <Modal visible={showFilterSheet} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowFilterSheet(false)}>
        <View style={filterS.container}>
          <View style={filterS.handle} />
          <View style={filterS.header}>
            <Text style={filterS.title}>filters</Text>
            <TouchableOpacity onPress={() => { setSelectedGenders([]); setSelectedDistance(null); }}>
              <Text style={filterS.resetText}>reset</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={filterS.scroll} contentContainerStyle={filterS.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={filterS.sectionLabel}>DISTANCE</Text>
            <View style={filterS.optionWrap}>
              {["5mi", "10mi", "25mi", "50mi", "100mi"].map(d => (
                <TouchableOpacity key={d} onPress={() => setSelectedDistance(d)} activeOpacity={0.8}
                  style={[filterS.option, selectedDistance === d && filterS.optionSelected]}>
                  <Text style={[filterS.optionText, selectedDistance === d && filterS.optionTextSelected]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={filterS.lockCard}>
              <View style={filterS.lockCardTop}>
                <Text style={filterS.lockCardTitle}>more filters</Text>
                <View style={filterS.goBadge}><Text style={filterS.goBadgeText}>Tandem Go</Text></View>
              </View>
              <View style={filterS.lockedTags}>
                {["Category", "Time of day", "Group size", "Indoors / outdoors"].map(f => (
                  <View key={f} style={filterS.lockedTag}><Text style={filterS.lockedTagText}>{f}</Text></View>
                ))}
              </View>
              <TouchableOpacity style={filterS.unlockBtn} activeOpacity={0.88} onPress={() => { setShowFilterSheet(false); onMembershipPress?.(); }}>
                <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={filterS.unlockBtnInner}>
                  <Text style={filterS.unlockBtnText}>Unlock Tandem Go</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
          <View style={filterS.footer}>
            <TouchableOpacity onPress={() => setShowFilterSheet(false)} style={filterS.showResultsBtn} activeOpacity={0.88}>
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={filterS.showResultsBtnInner}>
                <Text style={filterS.showResultsBtnText}>show results</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* I'm In Celebration */}
      <Modal visible={showCelebration} animationType="fade" transparent onRequestClose={handleCelebrationDismiss}>
        <View style={celebS.overlay}>
          <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={celebS.banner}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={celebS.bannerText}>request sent!</Text>
              <Text style={{ fontFamily: 'System', fontSize: 20, color: colors.white }}>🎉</Text>
            </View>
          </LinearGradient>
          <View style={celebS.card}>
            <SunnyAvatar expression="celebratory" size={72} />
            <Text style={celebS.headline}>request sent.</Text>
            <Text style={celebS.sub}>
              the host will let you know if you're in.
            </Text>
            <TouchableOpacity onPress={handleCelebrationDismiss} activeOpacity={0.88} style={celebS.btn}>
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={celebS.btnInner}>
                <Text style={celebS.btnText}>keep going</Text>
              </LinearGradient>
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
            />

            <Text style={modalS.sectionLabel}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={modalS.categoryScroll}>
              <View style={modalS.categoryRow}>
                {[
                  { emoji: "🏃", label: "sports" },
                  { emoji: "☕", label: "coffee" },
                  { emoji: "🎨", label: "creative" },
                  { emoji: "🥾", label: "hiking" },
                  { emoji: "🎵", label: "music" },
                  { emoji: "🛍", label: "markets" },
                ].map(c => (
                  <TouchableOpacity key={c.label} style={modalS.categoryTile} activeOpacity={0.8}>
                    <Text style={{ fontFamily: 'System', fontSize: 22 }}>{c.emoji}</Text>
                    <Text style={modalS.categoryLabel}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={modalS.rowFields}>
              <TouchableOpacity style={modalS.pillField}>
                <Ionicons name="calendar-outline" size={15} color={colors.teal} />
                <Text style={modalS.pillFieldText}>pick a date</Text>
              </TouchableOpacity>
              <TouchableOpacity style={modalS.pillField}>
                <Ionicons name="time-outline" size={15} color={colors.teal} />
                <Text style={modalS.pillFieldText}>pick a time</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={modalS.locationField}>
              <Ionicons name="location" size={15} color={colors.teal} />
              <Text style={modalS.pillFieldText}>where is it?</Text>
            </TouchableOpacity>

            <View style={modalS.spotsRow}>
              <Text style={modalS.spotsLabel}>spots</Text>
              <View style={modalS.spotsControls}>
                <TouchableOpacity style={modalS.spotsBtn}>
                  <Text style={modalS.spotsBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={modalS.spotsNum}>2</Text>
                <TouchableOpacity style={modalS.spotsBtnPlus}>
                  <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={modalS.spotsBtnPlusInner}>
                    <Text style={modalS.spotsBtnPlusText}>+</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>

            {/* Group activity row */}
            <View style={modalS.groupRow}>
              <Text style={modalS.groupLabel}>group activity</Text>
              {tier === "free" ? (
                <PremiumLock
                  tier="go"
                  featureName="group activity"
                  onPress={() => {
                    setShowPostModal(false);
                    setShowGroupUpsell(true);
                  }}
                />
              ) : (
                <Switch
                  value={isGroupActivity}
                  onValueChange={setIsGroupActivity}
                  trackColor={{ false: colors.border, true: colors.teal }}
                  thumbColor={colors.white}
                />
              )}
            </View>

            <TextInput
              style={modalS.descInput}
              placeholder="add any details..."
              placeholderTextColor={colors.muted}
              multiline
            />

            <TouchableOpacity style={modalS.postBtn} activeOpacity={0.88}
              onPress={() => { setShowPostModal(false); showToast("posting is almost here. stay tuned."); }}>
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={modalS.postBtnInner}>
                <Text style={modalS.postBtnText}>post it →</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Upsell Sheet — i'm in limit */}
      <UpsellSheet
        visible={showUpsell}
        onDismiss={() => setShowUpsell(false)}
        onUpgrade={() => { setShowUpsell(false); onMembershipPress?.(); }}
        headline="you've used your 3 free i'm ins."
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
            <Text style={reqS.title} numberOfLines={1}>{requestSheetActivity?.title ?? ""}</Text>
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
              requestSheetActivity?.pendingRequests.map(req => (
                <View key={req.id} style={reqS.requesterRow}>
                  <Image source={{ uri: req.photo }} style={reqS.requesterAvatar} />
                  <View style={reqS.requesterInfo}>
                    <Text style={reqS.requesterName}>{req.name}</Text>
                    <Text style={reqS.requesterBio} numberOfLines={2}>{req.bio}</Text>
                  </View>
                  <View style={reqS.requesterActions}>
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
                    <TouchableOpacity
                      style={reqS.passBtn}
                      activeOpacity={0.8}
                      onPress={() => handlePass(requestSheetActivity.id, req.id)}
                    >
                      <Text style={reqS.passBtnText}>pass</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
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
  deckContainer: { flex: 1, paddingHorizontal: 16 },
  deckProgress: { fontSize: 12, color: colors.muted, paddingTop: 10, paddingBottom: 6 },
  deckDone: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingBottom: 80 },
  deckDoneTitle: { fontSize: 18, fontWeight: "700", color: colors.foreground, textAlign: "center" },
  deckDoneDesc: { fontSize: 14, color: colors.muted, textAlign: "center", maxWidth: 260, lineHeight: 20 },

  // Card scroll
  cardScroll: { flex: 1 },
  cardScrollContent: { paddingTop: 4, paddingBottom: 12 },

  // Activity card
  cardWrapper: { gap: 4 },
  card: {
    backgroundColor: colors.white, borderRadius: radius.lg,
    overflow: "hidden", ...shadows.card,
  },
  photoWrap: { position: "relative" },
  cardPhoto: { width: "100%", height: 240, backgroundColor: colors.surface },
  categoryPill: {
    position: "absolute", bottom: 12, left: 12,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.88)", borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  categoryPillEmoji: { fontSize: 13 },
  categoryPillText: { fontSize: 11, fontWeight: "700", color: colors.foreground },
  featuredBadge: {
    position: "absolute", top: 12, right: 12,
    borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4,
  },
  featuredBadgeText: { fontSize: 10, fontWeight: "700", color: colors.white },
  cardBody: { padding: 14, gap: 6 },
  cardTitle: { fontSize: 18, fontWeight: "700", color: colors.foreground, letterSpacing: -0.3, marginBottom: 2 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  cardMetaTeal: { fontSize: 13, color: colors.teal, fontWeight: "600" },
  cardMetaGray: { fontSize: 13, color: colors.muted },
  vibeBox: {
    borderLeftWidth: 3, borderLeftColor: colors.teal,
    backgroundColor: "#F0FDFB", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 2,
  },
  vibeText: { fontSize: 13, fontStyle: "italic", color: colors.secondary, lineHeight: 19 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },

  // Host strip (below card)
  hostStrip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 },
  hostStripAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface },
  hostStripText: { fontSize: 12, color: colors.muted },
  hostStripName: { fontWeight: "700", color: colors.secondary },

  // Going row
  goingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatarStack: { flexDirection: "row" },
  stackAvatar: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.white, backgroundColor: colors.surface },
  goingText: { fontSize: 12, color: colors.muted, fontWeight: "500" },

  // Action buttons row
  actionRow: {
    flexDirection: "row", gap: 12,
    paddingTop: 12, paddingHorizontal: 0,
    backgroundColor: colors.background,
  },
  passBtn: {
    height: 52, borderRadius: radius.full,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: "#E5E7EB",
    alignItems: "center", justifyContent: "center",
  },
  passBtnText: { fontSize: 15, fontWeight: "600", color: "#6B7280" },
  imInBtn: {
    height: 52, borderRadius: radius.full,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#2DD4BF", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 8,
  },
  imInBtnText: { fontSize: 15, fontWeight: "700", color: colors.white },
  requestedBtn: {
    height: 52, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  requestedBtnText: { fontSize: 15, fontWeight: "600", color: colors.muted },

  // Toast
  toast: {
    position: "absolute", bottom: 100, alignSelf: "center",
    backgroundColor: "rgba(15,23,42,0.85)", borderRadius: radius.full,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  toastText: { fontSize: 13, color: colors.white, fontWeight: "500" },
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
  resetText: { fontSize: 14, fontWeight: "600", color: colors.teal },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 6, paddingBottom: 24 },
  sectionLabel: { fontSize: 10, fontWeight: "700", color: colors.muted, letterSpacing: 1.2, marginTop: 16, marginBottom: 10 },
  optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.full, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border },
  optionSelected: { borderColor: colors.teal, backgroundColor: colors.tintTeal },
  optionText: { fontSize: 14, fontWeight: "500", color: colors.foreground },
  optionTextSelected: { color: colors.teal, fontWeight: "600" },
  lockCard: { marginTop: 20, backgroundColor: colors.white, borderRadius: radius.lg, padding: 20, gap: 14, borderWidth: 1, borderColor: colors.border, ...shadows.card },
  lockCardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  lockCardTitle: { fontSize: 16, fontWeight: "700", color: colors.foreground },
  goBadge: { backgroundColor: colors.tintTeal, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  goBadgeText: { fontSize: 11, fontWeight: "700", color: colors.teal },
  lockedTags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  lockedTag: { backgroundColor: colors.surface, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  lockedTagText: { fontSize: 12, fontWeight: "500", color: colors.muted },
  unlockBtn: { height: 48, borderRadius: radius.full, overflow: "hidden", ...shadows.brand },
  unlockBtnInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  unlockBtnText: { fontSize: 14, fontWeight: "700", color: colors.white },
  footer: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  showResultsBtn: { height: 52, borderRadius: radius.full, overflow: "hidden", ...shadows.brand },
  showResultsBtnInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  showResultsBtnText: { fontSize: 15, fontWeight: "700", color: colors.white },
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
});

const celebS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  banner: { width: "100%", paddingVertical: 16, borderRadius: radius.lg, alignItems: "center", marginBottom: 16 },
  bannerText: { fontSize: 20, fontWeight: "800", color: colors.white, letterSpacing: -0.5 },
  card: { width: "100%", backgroundColor: colors.white, borderRadius: radius.xl, padding: 28, alignItems: "center", gap: 12, ...shadows.card },
  headline: { fontSize: 26, fontWeight: "800", color: colors.foreground, letterSpacing: -0.8, marginTop: 4 },
  sub: { fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 22, maxWidth: 260 },
  btn: { width: "100%", height: 52, borderRadius: radius.full, overflow: "hidden", marginTop: 8, ...shadows.brand },
  btnInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 15, fontWeight: "700", color: colors.white },
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
});
