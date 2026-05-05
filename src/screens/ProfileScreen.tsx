// SUPABASE SQL — run these if not already done:
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS photos text[];
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS video_url text;
// NOTIFY pgrst, 'reload schema';

import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Switch, ActivityIndicator, Modal, TextInput, Alert, Animated,
  KeyboardAvoidingView, Platform, Share,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomNav } from "../components/BottomNav";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { colors, radius, shadows, gradients } from "../theme";
import { useFonts, Caveat_400Regular, Caveat_700Bold } from "@expo-google-fonts/caveat";
import { getCardRotation } from "../theme/scrapbookTheme";
import { getSunnyResponse } from "../lib/sunny";
import { NotificationSettingsScreen } from "./NotificationSettingsScreen";
import { TrustStack } from "../components/safety/TrustStack";

const calculateAge = (birthday: string | null): number | null => {
  if (!birthday) return null;
  return Math.floor(
    (Date.now() - new Date(birthday).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
};

const VISIBILITY_FIELDS = [
  { key: "gender", label: "Gender" },
  { key: "sexuality", label: "Sexuality" },
  { key: "religion", label: "Religion" },
  { key: "relationship_status", label: "Relationship Status" },
  { key: "occupation", label: "Job / Occupation" },
  { key: "mbti", label: "Personality Type" },
  { key: "humor_type", label: "Humor Type" },
];

const PROMPT_LABELS: Record<string, string> = {
  ideal_saturday: "My ideal Saturday",
  friend_who: "I'm the friend who",
  count_on_me: "Count on me to",
  social_battery: "Social battery",
  weekend_vibe: "Weekend vibe",
};

const VIBE_TAG_OPTIONS = [
  "adventurous", "chill", "spontaneous", "reliable", "funny",
  "outdoorsy", "foodie", "creative", "night owl", "early bird",
  "dog person", "music lover", "bookworm", "gym rat", "homebody",
];


interface ProfileScreenProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
  onSettingsPress?: () => void;
  onMembershipPress?: () => void;
  onMessagesPress?: () => void;
  onPostPress?: () => void;
  onMyActivityPress?: () => void;
  onScrapbookPress?: () => void;
}

const ProfileVideo = ({ uri }: { uri: string }) => {
  const player = useVideoPlayer({ uri }, p => {
    p.loop = false;
  });
  return (
    <VideoView
      player={player}
      style={{ width: "100%", height: 220, borderRadius: 12 }}
      nativeControls
      contentFit="contain"
      allowsFullscreen
      allowsPictureInPicture={false}
    />
  );
};

export const ProfileScreen = ({ activeTab, onTabPress, onSettingsPress, onMembershipPress, onPostPress, onMyActivityPress, onScrapbookPress }: ProfileScreenProps) => {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [selectedVibeTags, setSelectedVibeTags] = useState<string[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [showLeaveNote, setShowLeaveNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteVibe, setNoteVibe] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fontsLoaded] = useFonts({ Caveat_400Regular, Caveat_700Bold });
  const caveat = (bold?: boolean) => fontsLoaded ? (bold ? "Caveat_700Bold" : "Caveat_400Regular") : undefined;
  const [memories, setMemories] = useState<any[]>([]);
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const player = useAudioPlayer(voiceUri ? { uri: voiceUri } : null);
  const pendingPlayRef = useRef(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const [profilePublic, setProfilePublic] = useState(true);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editOccupation, setEditOccupation] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editPronouns, setEditPronouns] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editBirthday, setEditBirthday] = useState("");
  const [editPersonality, setEditPersonality] = useState("");
  const [editHumor, setEditHumor] = useState<string[]>([]);
  const [editUsage, setEditUsage] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  const HUMOR_OPTIONS = ["dry", "sarcastic", "dark", "dad jokes", "absurdist", "self-deprecating", "improv energy"];
  const USAGE_OPTIONS = ["coffee & food", "outdoor & hiking", "fitness & sports", "arts & culture", "live music", "day trips", "studying", "casual hangouts"];
  const [activitiesCount, setActivitiesCount] = useState<number>(0);
  const [companionsCount, setCompanionsCount] = useState<number>(0);
  const [hostingCount, setHostingCount] = useState<number>(0);
  const [avatarError, setAvatarError] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const sunnyText = useRef<string | null>(null);
  const sunnyOpacity = useRef(new Animated.Value(0)).current;
  const sunnyFetched = useRef(false);
  const profileScrollRef = useRef<ScrollView>(null);

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  };

  useEffect(() => {
    setAvatarError(false);
    setAvatarLoading(false);
  }, [profile?.avatar_url]);

  // Auto-play once voiceUri is loaded into the player

  useEffect(() => {
    if (pendingPlayRef.current && voiceUri) {
      player.play();
      setIsPlayingAudio(true);
      pendingPlayRef.current = false;
    }
  }, [voiceUri]);

  const playVoiceMemo = async (uri: string) => {
    console.log("[Voice] attempting to play:", uri);
    console.log("[Voice] url from profile:", profile?.deep_prompts, profile?.photos);

    // file:// URIs are device-local and won't play on a different device
    if (uri.startsWith("file://")) {
      Alert.alert("voice memo unavailable", "this file is only available on the device it was recorded on.");
      return;
    }

    // Confirm URL is reachable before attempting playback
    try {
      const check = await fetch(uri, { method: "HEAD" });
      console.log("[Voice] URL status:", check.status, uri);
      if (!check.ok) {
        Alert.alert("voice memo unavailable", "the file could not be reached. it may still be processing.");
        return;
      }
    } catch (headErr: any) {
      console.log("[Voice] HEAD check failed:", headErr.message);
      Alert.alert("voice memo unavailable", "could not connect to the audio file.");
      return;
    }

    // Configure iOS audio session — critical for playback on ringer-silent devices
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        shouldPlayInBackground: false,
        interruptionMode: "doNotMix",
      });
    } catch (audioModeErr: any) {
      console.warn("[Voice] setAudioModeAsync failed:", audioModeErr.message);
    }

    if (player.playing) {
      player.pause();
      setIsPlayingAudio(false);
    } else if (voiceUri === uri) {
      // Same URI already loaded — play directly
      player.play();
      setIsPlayingAudio(true);
    } else {
      // New URI — set it and let the useEffect trigger play after load
      pendingPlayRef.current = true;
      setVoiceUri(uri);
    }
  };

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("activities").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("tandems").select("id", { count: "exact", head: true }).or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`),
      supabase.from("activities").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "active"),
    ]).then(([actRes, tandemRes, hostingRes]) => {
      setActivitiesCount(actRes.count ?? 0);
      setCompanionsCount(tandemRes.count ?? 0);
      setHostingCount(hostingRes.count ?? 0);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*, avatar_url, photos, video_url, deep_prompts").eq("user_id", user.id).single().then(({ data }) => {
      if (data) {
        setProfile(data);
        setVisibility((data.profile_visibility as Record<string, boolean>) || {
          gender: true, sexuality: true, religion: true,
          relationship_status: true, occupation: true, mbti: true, humor_type: true,
        });
        if (data.vibe_tags) setSelectedVibeTags(data.vibe_tags);
        setProfilePublic(data.is_public !== false);
        setEditFirstName(data.first_name || "");
        setEditBio(data.bio || "");
        setEditOccupation(data.occupation || "");
        setEditGender(data.gender || "");
        setEditPronouns(data.pronouns || "");
        setEditLocation(data.location_name || "");
        setEditBirthday(data.birthday || "");
        setEditPersonality(data.personality_type || "");
        setEditHumor(Array.isArray(data.humor_type) ? data.humor_type : []);
        setEditUsage(Array.isArray(data.usage_reasons) ? data.usage_reasons : []);
      }
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfile(data);
          setVisibility(
            (data.profile_visibility as Record<string, boolean>) || {
              gender: true, sexuality: true, religion: true,
              relationship_status: true, occupation: true, mbti: true, humor_type: true,
            }
          );
        }
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("scrapbook_memories")
      .select("id, title, cover_photo_url, is_public, stickers, created_at, scrapbook_photos(photo_url, display_order)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => { if (data) setMemories(data); });
  }, [user]);


  useEffect(() => {
    if (!profile || sunnyFetched.current) return;
    sunnyFetched.current = true;
    const ctx = isIncomplete ? "profileIncomplete" : "editProfile";
    getSunnyResponse({ context: ctx }).then(text => {
      sunnyText.current = text;
      setTimeout(() => {
        Animated.timing(sunnyOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      }, 700);
    });
  }, [profile]);

  const toggleProfilePublic = async () => {
    const next = !profilePublic;
    setProfilePublic(next);
    if (user) await supabase.from("profiles").update({ is_public: next } as any).eq("user_id", user.id);
  };

  const handlePhotoUpload = async () => {
    if (!user) return;
    try {
      const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permResult.status !== "granted") {
        Alert.alert(
          "photo library access needed",
          "go to Settings → Tandem → allow Photos, then try again."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images" as const,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      console.log("[ProfilePhoto] picker result:", JSON.stringify(result));
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      setUploadingPhoto(true);

      const fileExt = asset.uri.split(".").pop()?.toLowerCase() || "jpg";
      const mimeType = fileExt === "png" ? "image/png" : "image/jpeg";
      const fileName = `avatar_${Date.now()}.${fileExt}`;
      const storagePath = `${user.id}/${fileName}`;
      const formData = new FormData();
      formData.append("file", { uri: asset.uri, name: fileName, type: mimeType } as any);

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(storagePath, formData, {
          contentType: mimeType,
          upsert: true,
          cacheControl: "0",
        });

      console.log("[ProfilePhoto] upload error:", uploadError?.message);
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(storagePath);

      if (!urlData?.publicUrl) throw new Error("Could not get public URL after upload");

      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl, photos: [publicUrl] })
        .eq("user_id", user.id);

      if (updateError) throw new Error(`Profile update failed: ${updateError.message}`);

      // Wait for Supabase to propagate
      await new Promise(resolve => setTimeout(resolve, 800));

      const { data: refreshed, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (fetchError) throw new Error(`Re-fetch failed: ${fetchError.message}`);

      if (refreshed) {
        setProfile({ ...refreshed, _avatarCacheBust: Date.now() });
        if (refreshed.first_name) setEditFirstName(refreshed.first_name);
        if (refreshed.bio) setEditBio(refreshed.bio);
        if (refreshed.occupation) setEditOccupation(refreshed.occupation);
      }

      showToast("photo updated.");

    } catch (err: any) {
      Alert.alert("upload failed", err.message || "something went wrong. try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleShareProfile = async () => {
    try {
      const name = profile?.first_name || "someone";
      await Share.share({
        title: `${name} is on Tandem`,
        message: `${name} is on Tandem — the app where you find people to do things with. never go alone: https://thetandemweb.com`,
      });
    } catch (err: any) {
      console.warn("Share failed:", err.message);
    }
  };

  const toggleVisibility = async (key: string) => {
    const updated = { ...visibility, [key]: !(visibility[key] ?? true) };
    setVisibility(updated);
    if (user) await supabase.from("profiles").update({ profile_visibility: updated } as any).eq("user_id", user.id);
  };

  const toggleVibeTag = (tag: string) => {
    setSelectedVibeTags(prev => {
      const next = prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag];
      if (user) {
        supabase.from("profiles").update({ vibe_tags: next } as any).eq("user_id", user.id);
      }
      return next;
    });
  };

  const deleteComment = (id: string) => {
    setComments(prev => prev.filter(c => c.id !== id));
  };

  const submitNote = () => {
    if (!noteText.trim()) return;
    setComments(prev => [
      {
        id: `c-${Date.now()}`,
        name: "you",
        avatar: profile?.photos?.[0] || "",
        vibeTag: noteVibe || "chill",
        text: noteText.trim(),
        date: "just now",
      },
      ...prev,
    ]);
    setNoteText("");
    setNoteVibe("");
    setShowLeaveNote(false);
    showToast("note posted.");
  };

  const quickPrompts = profile?.quick_prompts || {};
  const deepPrompts = profile?.deep_prompts || {};

  // Profile completeness nudge
  const missingPhoto = !profile?.photos?.[0];
  const missingInterests = !profile?.occupation && !profile?.personality_type;
  const missingPrompts = Object.keys(quickPrompts).length === 0 && Object.keys(deepPrompts).length === 0;
  const isIncomplete = missingPhoto || missingInterests || missingPrompts;

  if (loading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={colors.teal} size="large" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Settings gear — top right */}
      <TouchableOpacity
        style={[s.gearBtn, { top: insets.top + 12 }]}
        onPress={onSettingsPress}
        activeOpacity={0.7}
      >
        <Ionicons name="settings-outline" size={22} color={colors.muted} />
      </TouchableOpacity>

      <ScrollView
        ref={profileScrollRef}
        style={s.scroll}
        contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile completeness nudge */}
        {isIncomplete && (
          <View style={s.completeBanner}>
            <Ionicons name="sparkles-outline" size={14} color={colors.teal} />
            <Text style={s.completeBannerText}>
              your profile is almost there. finish it up and show up more.
            </Text>
          </View>
        )}

        {/* Profile photo with gradient ring */}
        <View style={s.avatarSection}>
          <TouchableOpacity onPress={handlePhotoUpload} activeOpacity={0.85} disabled={uploadingPhoto}>
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatarRing}>
              <View style={s.avatarGap}>
                <View style={s.avatarInner}>
                  {uploadingPhoto ? (
                    <ActivityIndicator color={colors.teal} size="small" />
                  ) : (profile?.avatar_url?.startsWith("https://") && !avatarError) ? (
                    <>
                      <ExpoImage
                        source={{ uri: profile.avatar_url }}
                        style={s.avatarImage}
                        contentFit="cover"
                        onLoadStart={() => setAvatarLoading(true)}
                        onLoadEnd={() => { setAvatarLoading(false); setAvatarError(false); }}
                        onError={(e) => {
                          console.log("[Avatar] expo-image error:", e);
                          setAvatarError(true);
                        }}
                      />
                      {avatarLoading && (
                        <ActivityIndicator
                          color={colors.teal}
                          size="small"
                          style={{ position: "absolute" }}
                        />
                      )}
                    </>
                  ) : (
                    <View style={{ width: 91, height: 91, borderRadius: 45.5, backgroundColor: colors.teal, justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
                      <Text style={{ fontSize: 40, lineHeight: 91, color: "#FFFFFF", fontFamily: "Quicksand_700Bold", textAlign: "center" }}>
                        {profile?.first_name?.[0]?.toUpperCase() ?? "?"}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePhotoUpload} activeOpacity={0.7} disabled={uploadingPhoto}>
            <Text style={s.photoHint}>{uploadingPhoto ? "uploading..." : "tap to change photo"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowEditSheet(true)} activeOpacity={0.8}>
            <Text style={s.name}>{profile?.first_name || "Your name"}</Text>
          </TouchableOpacity>
          {profile?.birthday && (
            <Text style={s.ageText}>{calculateAge(profile.birthday)} years old</Text>
          )}
          <View style={s.locationRow}>
            <Ionicons name="location" size={13} color={colors.muted} />
            <Text style={s.location}>{profile?.location_name || "Princeton, NJ"}</Text>
          </View>
        </View>

        {/* Verification + trust signals */}
        {user?.id && (
          <View style={{ marginTop: 12, marginBottom: 4 }}>
            <TrustStack userId={user.id} viewerId={user.id} variant="profile" />
          </View>
        )}

        {/* Stat pills */}
        <View style={s.statsRow}>
          <TouchableOpacity style={s.statPill} activeOpacity={0.7} onPress={() => onTabPress("Discover")}>
            <Text style={s.statNum}>{activitiesCount}</Text>
            <Text style={s.statLabel}>activities</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.statPill} activeOpacity={0.7} onPress={() => showToast("your tandem companions — coming soon.")}>
            <Text style={s.statNum}>{companionsCount}</Text>
            <Text style={s.statLabel}>companions</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.statPill} activeOpacity={0.7} onPress={() => onMyActivityPress?.()}>
            <Text style={s.statNum}>{hostingCount}</Text>
            <Text style={s.statLabel}>hosting</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => onMyActivityPress?.()} activeOpacity={0.7} style={s.myActivityLink}>
          <Text style={s.myActivityLinkText}>view your posts & saved activities →</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => onScrapbookPress?.()} activeOpacity={0.7} style={s.myActivityLink}>
          <Text style={s.myActivityLinkText}>open your scrapbook →</Text>
        </TouchableOpacity>

        {/* Bio */}
        <TouchableOpacity onPress={() => setShowEditSheet(true)} activeOpacity={0.8}>
          <Text style={[s.bio, !profile?.bio && { color: colors.muted }]}>
            "{profile?.bio || "tap to add a bio"}"
          </Text>
        </TouchableOpacity>

        {/* Public profile banner */}
        <TouchableOpacity style={[s.publicBanner, profilePublic ? s.publicBannerOn : s.publicBannerOff]} onPress={toggleProfilePublic} activeOpacity={0.8}>
          <Ionicons name={profilePublic ? "eye-outline" : "eye-off-outline"} size={15} color={profilePublic ? colors.teal : colors.muted} />
          <Text style={[s.publicBannerText, { color: profilePublic ? colors.teal : colors.muted }]}>
            {profilePublic ? "your profile is public" : "your profile is private"}
          </Text>
          <View style={[s.publicDot, { backgroundColor: profilePublic ? colors.teal : colors.border }]} />
        </TouchableOpacity>

        {sunnyText.current ? (
          <Animated.Text style={[s.sunnyLine, { opacity: sunnyOpacity }]} numberOfLines={2}>
            {sunnyText.current}
          </Animated.Text>
        ) : null}

        {/* Hosting now */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>HOSTING NOW</Text>
          <TouchableOpacity onPress={() => onTabPress("Discover")} style={s.emptyCardCta} activeOpacity={0.8}>
            <Text style={s.emptyCardCtaText}>+ post an activity</Text>
          </TouchableOpacity>
        </View>

        {/* Been to */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>BEEN TO</Text>
          <TouchableOpacity onPress={() => onTabPress("Discover")} style={s.emptyCardCta} activeOpacity={0.8}>
            <Text style={s.emptyCardCtaText}>go find something to join →</Text>
          </TouchableOpacity>
        </View>

        {/* About chips from real profile */}
        {(profile?.occupation || profile?.personality_type || profile?.humor_type?.length) && (
          <View style={s.card}>
            <Text style={s.cardLabel}>ABOUT</Text>
            <View style={s.chips}>
              {profile?.occupation && (
                <TouchableOpacity onPress={() => setShowEditSheet(true)} activeOpacity={0.8} style={s.chip}>
                  <Text style={s.chipText}>{profile.occupation}</Text>
                </TouchableOpacity>
              )}
              {profile?.personality_type && (
                <TouchableOpacity onPress={() => setShowEditSheet(true)} activeOpacity={0.8} style={[s.chip, { backgroundColor: colors.tintBlue }]}>
                  <Text style={s.chipText}>{profile.personality_type}</Text>
                </TouchableOpacity>
              )}
              {profile?.humor_type?.map((h: string) => (
                <TouchableOpacity key={h} onPress={() => setShowEditSheet(true)} activeOpacity={0.8} style={[s.chip, { backgroundColor: colors.surface }]}>
                  <Text style={s.chipText}>{h}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Vibe tags */}
        <View style={s.section}>
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionLabel}>YOUR VIBE</Text>
            <Text style={s.sectionHint}>{selectedVibeTags.length}/5</Text>
          </View>
          <View style={s.vibeTagsWrap}>
            {VIBE_TAG_OPTIONS.map(tag => {
              const isSelected = selectedVibeTags.includes(tag);
              const isDisabled = !isSelected && selectedVibeTags.length >= 5;
              if (isSelected) {
                return (
                  <TouchableOpacity key={tag} onPress={() => toggleVibeTag(tag)} activeOpacity={0.8} style={s.vibeTagBtn}>
                    <LinearGradient
                      colors={gradients.brand}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={s.vibeTagSelected}
                    >
                      <Text style={s.vibeTagSelectedText}>{tag}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity
                  key={tag}
                  onPress={() => !isDisabled && toggleVibeTag(tag)}
                  activeOpacity={isDisabled ? 1 : 0.8}
                  style={s.vibeTagBtn}
                >
                  <View style={[s.vibeTag, isDisabled && s.vibeTagDisabled]}>
                    <Text style={[s.vibeTagText, isDisabled && s.vibeTagTextDisabled]}>{tag}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Prompts */}
        {Object.entries(quickPrompts).map(([key, value]) => (
          <TouchableOpacity key={key} onPress={() => setShowEditSheet(true)} activeOpacity={0.85} style={s.promptBlock}>
            <Text style={s.promptLabel}>{(PROMPT_LABELS[key] || key).toUpperCase()}</Text>
            <Text style={s.promptAnswer}>"{String(value)}"</Text>
          </TouchableOpacity>
        ))}
        {Object.entries(deepPrompts).map(([prompt, answer]) => {
          const answerStr = String(answer);
          const isVoice = answerStr.startsWith("file://") || answerStr.includes(".m4a") || answerStr.includes("voice-memos") || answerStr.includes("deep-prompt-media") || answerStr.includes("audio/");
          const isVideo = (answerStr.endsWith(".mp4") || answerStr.includes("videos/") || answerStr.includes(".mov")) && !answerStr.includes("deep-prompt-media");

          // Video takes priority — don't double-show voice memo when profile.video_url is set
          if (isVoice && profile?.video_url) return null;

          return (
            <View key={prompt} style={s.promptBlock}>
              <Text style={s.promptLabel}>{prompt.toUpperCase()}</Text>
              {isVoice ? (
                <TouchableOpacity
                  onPress={() => playVoiceMemo(answerStr)}
                  activeOpacity={0.8}
                  style={s.mediaPlayBtn}
                >
                  <Ionicons
                    name={isPlayingAudio ? "pause-circle" : "play-circle"}
                    size={24}
                    color={colors.teal}
                  />
                  <Text style={s.mediaPlayText}>
                    {isPlayingAudio ? "playing..." : "play voice memo"}
                  </Text>
                </TouchableOpacity>
              ) : isVideo ? (
                <ProfileVideo uri={answerStr} />
              ) : (
                <Text style={s.promptAnswer}>"{answerStr}"</Text>
              )}
            </View>
          );
        })}

        {/* Also show profile video_url if it exists */}
        {profile?.video_url && (
          <View style={s.promptBlock}>
            <Text style={s.promptLabel}>intro video</Text>
            <ProfileVideo uri={profile.video_url} />
          </View>
        )}

        {/* Memories section */}
        {memories.length > 0 ? (
          <View style={s.section}>
            <View style={s.sectionHeaderRow}>
              <Text style={[s.memoriesHeader, { fontFamily: caveat(true) }]}>memories</Text>
              <TouchableOpacity onPress={() => Alert.alert("see all memories", "coming soon.")} activeOpacity={0.7}>
                <Text style={s.memoriesSeeAll}>see all →</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
              {memories.map(m => {
                const photoUri = m.cover_photo_url || m.scrapbook_photos?.[0]?.photo_url;
                const rotation = `${getCardRotation(m.id)}deg`;
                return (
                  <View key={m.id} style={[ms.miniCard, { transform: [{ rotate: rotation }] }]}>
                    <View style={ms.miniPhoto}>
                      {photoUri
                        ? <Image source={{ uri: photoUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                        : <Image source={require("../../assets/icon.png")} style={{ width: 24, height: 24, opacity: 0.3 }} resizeMode="contain" />}
                    </View>
                    <Text style={[ms.miniTitle, { fontFamily: caveat(false) }]} numberOfLines={1}>{m.title}</Text>
                    {m.is_public
                      ? <View style={ms.publicDot} />
                      : <View style={ms.privateDot} />}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ) : (
          <View style={s.section}>
            <Text style={[s.memoriesHeader, { fontFamily: caveat(true) }]}>memories</Text>
            <Text style={ms.emptyHint}>memories you mark public will show up here</Text>
          </View>
        )}

        {/* Comments from tandem companions */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>FROM PEOPLE I'VE TANDEM'D WITH</Text>
          {comments.map(c => (
            <View key={c.id} style={s.commentRow}>
              {c.avatar ? (
                <Image source={{ uri: c.avatar }} style={s.commentAvatar} />
              ) : (
                <View style={[s.commentAvatar, s.commentAvatarPlaceholder]}>
                  <Text style={s.commentAvatarInitial}>{c.name[0].toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={s.commentName}>{c.name}</Text>
                  <LinearGradient
                    colors={gradients.brand}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={s.commentVibePill}
                  >
                    <Text style={s.commentVibeText}>{c.vibeTag}</Text>
                  </LinearGradient>
                </View>
                <Text style={s.commentText}>{c.text}</Text>
                <Text style={s.commentDate}>{c.date}</Text>
              </View>
              <TouchableOpacity onPress={() => deleteComment(c.id)} activeOpacity={0.7} style={s.commentDelete}>
                <Ionicons name="trash-outline" size={15} color={colors.muted} />
              </TouchableOpacity>
            </View>
          ))}
          {/* TODO: gate by tandem history — for now visible to everyone */}
          <TouchableOpacity style={s.leaveNoteBtn} onPress={() => setShowLeaveNote(true)} activeOpacity={0.8}>
            <Text style={s.leaveNoteBtnText}>leave a note</Text>
          </TouchableOpacity>
        </View>

        {/* Notification preferences */}
        <TouchableOpacity onPress={() => setShowNotifSettings(true)} style={s.privacyToggle} activeOpacity={0.7}>
          <Text style={s.privacyToggleText}>notification preferences →</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.muted} />
        </TouchableOpacity>

        {/* Privacy */}
        <TouchableOpacity onPress={() => setShowPrivacy(!showPrivacy)} style={s.privacyToggle} activeOpacity={0.7}>
          <Text style={s.privacyToggleText}>manage what others see →</Text>
          <Ionicons name={showPrivacy ? "chevron-up" : "chevron-down"} size={14} color={colors.muted} />
        </TouchableOpacity>
        {showPrivacy && (
          <View style={s.card}>
            <Text style={s.cardLabelSub}>Toggle off anything you don't want shown publicly</Text>
            {VISIBILITY_FIELDS.map(({ key, label }) => (
              <View key={key} style={s.privacyRow}>
                <Text style={s.privacyLabel}>{label}</Text>
                <Switch
                  value={visibility[key] ?? true}
                  onValueChange={() => toggleVisibility(key)}
                  trackColor={{ false: colors.border, true: colors.teal }}
                  thumbColor={colors.white}
                />
              </View>
            ))}
          </View>
        )}

        {/* Share + Edit + Upgrade */}
        <View style={{ gap: 10 }}>
          <TouchableOpacity onPress={handleShareProfile} activeOpacity={0.7} style={s.shareProfileBtn}>
            <Ionicons name="share-outline" size={15} color={colors.muted} />
            <Text style={s.shareProfileText}>share your profile</Text>
          </TouchableOpacity>
          <View style={s.actionRow}>
            <TouchableOpacity style={s.outlineBtn} activeOpacity={0.85} onPress={() => setShowEditSheet(true)}>
              <Text style={s.outlineBtnText}>edit profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.upgradeWrap} activeOpacity={0.85} onPress={onMembershipPress}>
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.upgradeInner}>
                <Text style={s.upgradeText}>upgrade</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => setShowDeleteModal(true)} activeOpacity={0.7} style={{ alignSelf: "center", paddingVertical: 8 }}>
            <Text style={s.deleteAccountText}>delete my account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {!!toast && (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}

      <BottomNav activeTab={activeTab} onTabPress={onTabPress} onPostPress={onPostPress} />

      {/* Edit Profile sheet */}
      <Modal
        visible={showEditSheet}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditSheet(false)}
      >
        <KeyboardAvoidingView style={es.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={es.handle} />
          <View style={es.header}>
            <Text style={es.title}>edit profile</Text>
            <TouchableOpacity onPress={() => setShowEditSheet(false)} style={es.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={es.scroll} contentContainerStyle={es.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Photo */}
            <View style={es.photoRow}>
              <TouchableOpacity onPress={handlePhotoUpload} activeOpacity={0.85} disabled={uploadingPhoto}>
                <View style={es.editAvatar}>
                  {uploadingPhoto ? (
                    <ActivityIndicator color={colors.teal} />
                  ) : (profile?.avatar_url?.startsWith("https://") && !avatarError) ? (
                    <ExpoImage
                      source={{ uri: profile.avatar_url }}
                      style={es.editAvatarImg}
                      contentFit="cover"
                      onError={(e) => {
                        console.log("[Avatar] expo-image error:", e);
                        setAvatarError(true);
                      }}
                    />
                  ) : (
                    <View style={[es.editAvatarImg, { backgroundColor: colors.teal, alignItems: "center", justifyContent: "center" }]}>
                      <Text style={{ fontSize: 28, color: "#fff", fontWeight: "700", fontFamily: "Quicksand_700Bold" }}>{editFirstName?.[0]?.toUpperCase() ?? "?"}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePhotoUpload} activeOpacity={0.7} disabled={uploadingPhoto}>
                <Text style={es.photoHintText}>{uploadingPhoto ? "uploading..." : "change photo"}</Text>
              </TouchableOpacity>
            </View>

            <Text style={es.label}>FIRST NAME</Text>
            <TextInput
              style={es.input}
              value={editFirstName}
              onChangeText={setEditFirstName}
              placeholder="your first name"
              placeholderTextColor={colors.muted}
              autoCapitalize="words"
            />

            <Text style={es.label}>BIO</Text>
            <TextInput
              style={[es.input, es.inputMultiline]}
              value={editBio}
              onChangeText={setEditBio}
              placeholder="a line about yourself"
              placeholderTextColor={colors.muted}
              multiline
              maxLength={160}
            />

            <Text style={es.label}>OCCUPATION</Text>
            <TextInput
              style={es.input}
              value={editOccupation}
              onChangeText={setEditOccupation}
              placeholder="what do you do?"
              placeholderTextColor={colors.muted}
            />

            <Text style={es.label}>GENDER</Text>
            <TextInput
              style={es.input}
              value={editGender}
              onChangeText={setEditGender}
              placeholder="e.g. woman, man, non-binary..."
              placeholderTextColor={colors.muted}
            />

            <Text style={es.label}>PRONOUNS</Text>
            <TextInput
              style={es.input}
              value={editPronouns}
              onChangeText={setEditPronouns}
              placeholder="e.g. she/her, they/them..."
              placeholderTextColor={colors.muted}
            />

            <Text style={es.label}>NEIGHBORHOOD / CITY</Text>
            <TextInput
              style={es.input}
              value={editLocation}
              onChangeText={setEditLocation}
              placeholder="where are you based?"
              placeholderTextColor={colors.muted}
            />

            <Text style={es.label}>BIRTHDAY</Text>
            <TextInput
              style={es.input}
              value={editBirthday}
              onChangeText={setEditBirthday}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={es.label}>PERSONALITY TYPE</Text>
            <TextInput
              style={es.input}
              value={editPersonality}
              onChangeText={setEditPersonality}
              placeholder="MBTI, enneagram, or just vibe..."
              placeholderTextColor={colors.muted}
            />

            <Text style={es.label}>HUMOR STYLE</Text>
            <View style={es.pillRow}>
              {HUMOR_OPTIONS.map(opt => {
                const sel = editHumor.includes(opt);
                return sel ? (
                  <TouchableOpacity key={opt} onPress={() => setEditHumor(prev => prev.filter(h => h !== opt))} activeOpacity={0.8}>
                    <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={es.pillSelected}>
                      <Text style={es.pillSelectedText}>{opt}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity key={opt} onPress={() => setEditHumor(prev => [...prev, opt])} activeOpacity={0.8} style={es.pill}>
                    <Text style={es.pillText}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={es.label}>LOOKING FOR</Text>
            <View style={es.pillRow}>
              {USAGE_OPTIONS.map(opt => {
                const sel = editUsage.includes(opt);
                return sel ? (
                  <TouchableOpacity key={opt} onPress={() => setEditUsage(prev => prev.filter(u => u !== opt))} activeOpacity={0.8}>
                    <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={es.pillSelected}>
                      <Text style={es.pillSelectedText}>{opt}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity key={opt} onPress={() => setEditUsage(prev => [...prev, opt])} activeOpacity={0.8} style={es.pill}>
                    <Text style={es.pillText}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={es.saveBtn}
              activeOpacity={0.88}
              disabled={editSaving}
              onPress={async () => {
                setEditSaving(true);
                const { error } = await supabase
                  .from("profiles")
                  .update({
                    first_name: editFirstName.trim(),
                    bio: editBio.trim(),
                    occupation: editOccupation.trim(),
                    gender: editGender.trim(),
                    pronouns: editPronouns.trim(),
                    location_name: editLocation.trim(),
                    birthday: editBirthday.trim() || null,
                    personality_type: editPersonality.trim(),
                    humor_type: editHumor,
                    usage_reasons: editUsage,
                  } as any)
                  .eq("user_id", user!.id);
                if (error) {
                  Alert.alert("Couldn't save", error.message);
                  setEditSaving(false);
                  return;
                }
                setProfile((prev: any) => ({
                  ...prev,
                  first_name: editFirstName.trim(),
                  bio: editBio.trim(),
                  occupation: editOccupation.trim(),
                  gender: editGender.trim(),
                  pronouns: editPronouns.trim(),
                  location_name: editLocation.trim(),
                  birthday: editBirthday.trim() || null,
                  personality_type: editPersonality.trim(),
                  humor_type: editHumor,
                  usage_reasons: editUsage,
                }));
                setEditSaving(false);
                setShowEditSheet(false);
                showToast("profile updated.");
              }}
            >
              <LinearGradient
                colors={gradients.brand}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={es.saveBtnInner}
              >
                {editSaving
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <Text style={es.saveBtnText}>save changes</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Notification settings */}
      <Modal
        visible={showNotifSettings}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNotifSettings(false)}
      >
        <NotificationSettingsScreen onBack={() => setShowNotifSettings(false)} />
      </Modal>

      {/* Delete account confirmation modal */}
      <Modal
        visible={showDeleteModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={del.backdrop}>
          <View style={del.card}>
            <Text style={del.title}>delete your account?</Text>
            <Text style={del.body}>
              this deletes your profile, posts, messages, and scrapbook permanently. this cannot be undone.
            </Text>
            <TouchableOpacity
              style={del.deleteBtn}
              activeOpacity={0.88}
              disabled={deletingAccount}
              onPress={async () => {
                setDeletingAccount(true);
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session?.access_token) throw new Error("no session");
                  const res = await fetch(
                    "https://ccntlaunczirvntnsjbm.supabase.co/functions/v1/delete-account",
                    {
                      method: "POST",
                      headers: { Authorization: `Bearer ${session.access_token}` },
                    }
                  );
                  if (!res.ok) throw new Error(await res.text());
                  await signOut();
                } catch (err: any) {
                  Alert.alert("something went wrong", err.message || "try again.");
                  setDeletingAccount(false);
                }
              }}
            >
              {deletingAccount
                ? <ActivityIndicator color={colors.white} size="small" />
                : <Text style={del.deleteBtnText}>delete forever</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowDeleteModal(false)} activeOpacity={0.7} style={{ paddingVertical: 12 }}>
              <Text style={del.cancelText}>cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Leave a note bottom sheet */}
      <Modal
        visible={showLeaveNote}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLeaveNote(false)}
      >
        <View style={ls.container}>
          <View style={ls.handle} />
          <Text style={ls.title}>leave a note</Text>
          <Text style={ls.subtitle}>something genuine. they'll see it on their profile.</Text>

          <TextInput
            style={ls.input}
            placeholder="what was it like tandeming with them?"
            placeholderTextColor={colors.muted}
            value={noteText}
            onChangeText={setNoteText}
            multiline
            maxLength={160}
          />
          <Text style={ls.charCount}>{noteText.length}/160</Text>

          <Text style={ls.vibeLabel}>pick a vibe tag</Text>
          <View style={ls.vibeTags}>
            {["reliable", "funny", "adventurous", "chill", "spontaneous", "creative", "outdoorsy", "foodie"].map(tag => {
              const isSelected = noteVibe === tag;
              return (
                <TouchableOpacity key={tag} onPress={() => setNoteVibe(tag)} activeOpacity={0.8}>
                  {isSelected ? (
                    <LinearGradient
                      colors={gradients.brand}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={ls.vibeTagSelected}
                    >
                      <Text style={ls.vibeTagSelectedText}>{tag}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={ls.vibeTag}>
                      <Text style={ls.vibeTagText}>{tag}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={ls.submitBtn} onPress={submitNote} activeOpacity={0.88}>
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={ls.submitBtnInner}
            >
              <Text style={ls.submitBtnText}>post it</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowLeaveNote(false)} activeOpacity={0.7} style={ls.cancelBtn}>
            <Text style={ls.cancelText}>cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  gearBtn: { position: "absolute", right: 16, zIndex: 10, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 14 },

  // Completeness banner
  completeBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#F0FDFB",
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.teal,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  completeBannerText: { flex: 1, fontSize: 13, color: colors.teal, fontWeight: "500", fontFamily: "Quicksand_500Medium", lineHeight: 18 },

  // Avatar section
  avatarSection: { alignItems: "center", gap: 10, paddingTop: 40 },
  avatarRing: { width: 96, height: 96, borderRadius: 48, padding: 2.5 },
  avatarGap: { flex: 1, borderRadius: 46, backgroundColor: colors.white, padding: 3 },
  avatarInner: { flex: 1, borderRadius: 43, backgroundColor: colors.surface, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  avatarImage: { width: "100%", height: "100%" },
  avatarInitial: { fontSize: 32, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.muted },
  avatarPlaceholder: { flex: 1, borderRadius: 43, backgroundColor: "#F0FDFB", alignItems: "center", justifyContent: "center" },
  photoHint: { fontSize: 12, color: colors.teal, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", marginTop: -4 },
  name: { fontSize: 22, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground, letterSpacing: -0.4 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  location: { fontSize: 13, color: colors.muted, fontWeight: "500", fontFamily: "Quicksand_500Medium" },
  ageText: { fontSize: 13, color: colors.muted, fontWeight: "500", fontFamily: "Quicksand_500Medium" },

  // My Activity link
  myActivityLink: { alignSelf: "center", paddingVertical: 6, paddingHorizontal: 16 },
  myActivityLinkText: { fontSize: 12, color: colors.teal, fontWeight: "600", fontFamily: "Quicksand_600SemiBold" },

  // Stat pills
  statsRow: { flexDirection: "row", justifyContent: "center", gap: 10 },
  statPill: {
    flexDirection: "row", alignItems: "baseline", gap: 5,
    backgroundColor: colors.white, borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1.5, borderColor: colors.border,
    ...shadows.card,
  },
  statNum: { fontSize: 15, fontWeight: "800", fontFamily: "Quicksand_700Bold", color: colors.teal },
  statLabel: { fontSize: 12, color: colors.muted, fontWeight: "500", fontFamily: "Quicksand_500Medium" },

  // Bio
  bio: { fontSize: 14, fontFamily: "Quicksand_400Regular", color: colors.muted, fontStyle: "italic", textAlign: "center", lineHeight: 22, paddingHorizontal: 8 },

  // Section
  section: { gap: 10 },
  sectionLabel: { fontSize: 10, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.muted, letterSpacing: 1.4 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionHint: { fontSize: 11, fontFamily: "Quicksand_400Regular", color: colors.muted },
  hScroll: { gap: 12, paddingBottom: 4 },

  // Empty card CTAs
  emptyCardCta: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: "center" as const,
  },
  emptyCardCtaText: {
    fontSize: 13,
    fontWeight: "600" as const,
    fontFamily: "Quicksand_600SemiBold",
    color: colors.teal,
  },

  // Activity cards
  actCard: {
    width: 140, backgroundColor: colors.white, borderRadius: radius.md,
    overflow: "hidden", ...shadows.card, borderWidth: 1, borderColor: colors.border,
  },
  beenCard: { opacity: 0.9 },
  actPhoto: { width: "100%", height: 90, backgroundColor: colors.surface },
  actBody: { padding: 10, gap: 3 },
  actTitle: { fontSize: 13, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground, lineHeight: 18 },
  actDate: { fontSize: 11, fontFamily: "Quicksand_400Regular", color: colors.muted },
  openBadge: {
    position: "absolute", top: 8, left: 8,
    backgroundColor: colors.teal, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  openText: { fontSize: 10, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.white },
  spotsBadge: {
    position: "absolute", top: 8, right: 8,
    backgroundColor: "rgba(255,255,255,0.9)", borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  spotsText: { fontSize: 10, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.foreground },

  // Cards / chips
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 16, ...shadows.card, borderWidth: 1, borderColor: colors.border, gap: 10 },
  cardLabel: { fontSize: 10, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.muted, letterSpacing: 1.2 },
  cardLabelSub: { fontSize: 12, fontFamily: "Quicksand_400Regular", color: colors.muted, lineHeight: 18 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { backgroundColor: colors.tintTeal, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full },
  chipText: { fontSize: 12, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.foreground },

  // Vibe tags
  vibeTagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  vibeTagBtn: { overflow: "hidden", borderRadius: radius.full },
  vibeTagSelected: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full },
  vibeTagSelectedText: { fontSize: 12, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.white },
  vibeTag: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  vibeTagDisabled: { opacity: 0.4 },
  vibeTagText: { fontSize: 12, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.foreground },
  vibeTagTextDisabled: { color: colors.muted },

  // Prompts
  promptBlock: { backgroundColor: colors.tintTeal, borderRadius: radius.md, padding: 16, borderLeftWidth: 3, borderLeftColor: colors.teal },
  promptLabel: { fontSize: 10, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.teal, letterSpacing: 1.2, marginBottom: 6 },
  promptAnswer: { fontSize: 15, fontWeight: "500", fontFamily: "Quicksand_500Medium", color: colors.foreground, fontStyle: "italic", lineHeight: 22 },
  mediaPlayBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    backgroundColor: colors.tintTeal,
    borderRadius: radius.full,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 6,
  },
  mediaPlayText: {
    fontSize: 14,
    fontWeight: "600" as const,
    fontFamily: "Quicksand_600SemiBold",
    color: colors.teal,
  },

  // Comments
  commentRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: colors.white, borderRadius: radius.md,
    padding: 14, borderWidth: 1, borderColor: colors.border,
  },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface },
  commentAvatarPlaceholder: { backgroundColor: colors.tintTeal, alignItems: "center", justifyContent: "center" },
  commentAvatarInitial: { fontSize: 14, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.teal },
  commentName: { fontSize: 13, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground },
  commentVibePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  commentVibeText: { fontSize: 10, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.white },
  commentText: { fontSize: 13, fontFamily: "Quicksand_400Regular", color: colors.secondary, lineHeight: 18 },
  commentDate: { fontSize: 11, fontFamily: "Quicksand_400Regular", color: colors.muted },
  commentDelete: { padding: 4 },
  leaveNoteBtn: {
    height: 44, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.teal,
    alignItems: "center", justifyContent: "center",
  },
  leaveNoteBtnText: { fontSize: 14, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.teal },

  // Privacy
  privacyToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 2 },
  privacyToggleText: { fontSize: 13, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.muted },
  privacyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  privacyLabel: { fontSize: 14, fontFamily: "Quicksand_400Regular", color: colors.foreground },

  // Actions
  shareProfileBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: radius.full, borderWidth: 1.5,
    borderColor: colors.border, backgroundColor: colors.white,
  },
  shareProfileText: { fontSize: 13, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.muted },
  actionRow: { flexDirection: "row", gap: 12 },
  outlineBtn: { flex: 1, height: 48, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  outlineBtnText: { fontSize: 14, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.foreground },
  upgradeWrap: { flex: 1, height: 48, borderRadius: radius.full, overflow: "hidden", ...shadows.brand },
  upgradeInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  upgradeText: { fontSize: 14, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.white },

  toast: { position: "absolute", bottom: 100, alignSelf: "center", backgroundColor: "rgba(15,23,42,0.85)", borderRadius: radius.full, paddingHorizontal: 20, paddingVertical: 10 },
  toastText: { fontSize: 13, color: colors.white, fontWeight: "500", fontFamily: "Quicksand_500Medium" },
  deleteAccountText: { fontSize: 13, color: "#EF4444", fontFamily: "Quicksand_500Medium" },

  // Memories
  memoriesHeader: { fontSize: 16, color: "#1a1a1a" },
  memoriesSeeAll: { fontSize: 11, color: "#1D9E75", fontWeight: "600", fontFamily: "Quicksand_600SemiBold" },

  publicBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20 },
  publicBannerOn: { backgroundColor: "#E8FBF7", borderWidth: 1, borderColor: "#A7EDD9" },
  publicBannerOff: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  publicBannerText: { flex: 1, fontSize: 13, fontWeight: "500", fontFamily: "Quicksand_500Medium" },
  publicDot: { width: 8, height: 8, borderRadius: 4 },
  avatarCameraBtn: { position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.teal, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.background },
  sunnyLine: { fontStyle: "italic", fontSize: 13, fontFamily: "Quicksand_400Regular", color: "#888", textAlign: "center", paddingHorizontal: 20, marginBottom: 8 },
});

// Mini memory card styles
const ms = StyleSheet.create({
  miniCard: {
    width: 82, backgroundColor: "#fff",
    borderWidth: 0.5, borderColor: "#E0D8C8", borderRadius: 4,
    padding: 4, paddingBottom: 10,
    shadowColor: "#8B7A5A", shadowOpacity: 0.12, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    alignItems: "center",
  },
  miniPhoto: {
    width: "100%", height: 64, backgroundColor: "#FAF0D4",
    borderRadius: 3, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  miniTitle: { fontSize: 9, color: "#1a1a1a", textAlign: "center" },
  publicDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#1D9E75", marginTop: 3 },
  privateDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#E0D8C8", marginTop: 3 },
  emptyHint: { fontSize: 12, fontFamily: "Quicksand_400Regular", color: "#A08040", fontStyle: "italic" },
});

// Leave a note modal styles
const ls = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.background,
    paddingHorizontal: 24, paddingTop: 8,
  },
  handle: {
    width: 36, height: 4, backgroundColor: colors.border,
    borderRadius: 2, alignSelf: "center", marginBottom: 24,
  },
  title: { fontSize: 20, fontWeight: "800", fontFamily: "Quicksand_700Bold", color: colors.foreground, marginBottom: 4 },
  subtitle: { fontSize: 14, fontFamily: "Quicksand_400Regular", color: colors.muted, lineHeight: 20, marginBottom: 20 },
  input: {
    backgroundColor: colors.white, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    padding: 14, fontSize: 15, color: colors.foreground,
    minHeight: 100, textAlignVertical: "top",
    lineHeight: 22,
  },
  charCount: { fontSize: 11, fontFamily: "Quicksand_400Regular", color: colors.muted, alignSelf: "flex-end", marginTop: 4, marginBottom: 16 },
  vibeLabel: { fontSize: 12, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.muted, letterSpacing: 1, marginBottom: 10 },
  vibeTags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 28 },
  vibeTagSelected: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full },
  vibeTagSelectedText: { fontSize: 12, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.white },
  vibeTag: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white,
  },
  vibeTagText: { fontSize: 12, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.foreground },
  submitBtn: { height: 52, borderRadius: 26, overflow: "hidden" },
  submitBtnInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  submitBtnText: { fontSize: 15, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.white },
  cancelBtn: { alignItems: "center", paddingVertical: 16 },
  cancelText: { fontSize: 14, fontFamily: "Quicksand_400Regular", color: colors.muted },
});

// Delete account modal styles
const del = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  card: { backgroundColor: colors.background, borderRadius: radius.xl, padding: 24, width: "100%", gap: 12, alignItems: "center" },
  title: { fontSize: 18, fontWeight: "800", fontFamily: "Quicksand_700Bold", color: "#EF4444", textAlign: "center" },
  body: { fontSize: 14, fontFamily: "Quicksand_400Regular", color: colors.secondary, textAlign: "center", lineHeight: 20 },
  deleteBtn: { width: "100%", height: 48, borderRadius: radius.full, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", marginTop: 4 },
  deleteBtnText: { fontSize: 15, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.white },
  cancelText: { fontSize: 14, fontFamily: "Quicksand_400Regular", color: colors.muted },
});

// Edit profile sheet styles
const es = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  handle: {
    width: 36, height: 4, backgroundColor: colors.border,
    borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 8,
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: "800", fontFamily: "Quicksand_700Bold", color: colors.foreground },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 4 },
  label: { fontSize: 10, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.muted, letterSpacing: 1.4, marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: colors.white, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: colors.foreground,
  },
  inputMultiline: { minHeight: 90, textAlignVertical: "top", lineHeight: 22 },
  photoNote: { fontSize: 12, color: colors.muted, fontStyle: "italic", marginTop: 20, marginBottom: 8 },
  saveBtn: { height: 52, borderRadius: 26, overflow: "hidden", marginTop: 12 },
  saveBtnInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  saveBtnText: { fontSize: 15, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.white },
  photoRow: { alignItems: "center", gap: 8, paddingBottom: 8 },
  editAvatar: { width: 72, height: 72, borderRadius: 36, overflow: "hidden", backgroundColor: colors.surface },
  editAvatarImg: { width: 72, height: 72, borderRadius: 36 },
  photoHintText: { fontSize: 12, color: colors.teal, fontWeight: "600", fontFamily: "Quicksand_600SemiBold" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  pill: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  pillText: { fontSize: 13, color: colors.foreground, fontWeight: "500", fontFamily: "Quicksand_500Medium" },
  pillSelected: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full },
  pillSelectedText: { fontSize: 13, color: colors.white, fontWeight: "600", fontFamily: "Quicksand_600SemiBold" },
});
