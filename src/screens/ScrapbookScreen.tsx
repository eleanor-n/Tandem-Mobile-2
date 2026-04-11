import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Image, Modal, TextInput, Animated,
  SectionList, Alert, ActivityIndicator, ActionSheetIOS, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFonts, Caveat_400Regular, Caveat_700Bold } from "@expo-google-fonts/caveat";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import ViewShot from "react-native-view-shot";
import { Ionicons } from "@expo/vector-icons";
import { BottomNav } from "../components/BottomNav";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { radius, gradients } from "../theme";
import { SB, STICKERS, getCardRotation } from "../theme/scrapbookTheme";
import { getSunnyResponse } from "../lib/sunny";

const { width: W } = Dimensions.get("window");
const CARD_W = W - 48; // 24px each side

// ── Types ──────────────────────────────────────────────────────────────────

interface ScrapbookPhoto {
  photo_url: string;
  display_order: number;
}

interface ScrapbookMemory {
  id: string;
  user_id: string;
  title: string;
  partner_name?: string;
  activity_date?: string;
  location?: string;
  cover_photo_url?: string;
  is_public: boolean;
  caption?: string;
  stickers: string[];
  tags?: string[];
  photos?: ScrapbookPhoto[];
  created_at: string;
}

// ── Mock data ─────────────────────────────────────────────────────────────


// ── Helpers ───────────────────────────────────────────────────────────────

const formatDate = (d?: string) => {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }); } catch { return ""; }
};

const MONTH_MAP: Record<number, string> = {
  0: "january", 1: "february", 2: "march", 3: "april", 4: "may", 5: "june",
  6: "july", 7: "august", 8: "september", 9: "october", 10: "november", 11: "december",
};
const monthLabel = (iso: string) => {
  const d = new Date(iso);
  return `${MONTH_MAP[d.getMonth()]} ${d.getFullYear()}`;
};

// ── AnimatedToggle ────────────────────────────────────────────────────────

const AnimatedToggle = ({ value, onToggle }: { value: boolean; onToggle: () => void }) => {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: value ? 1 : 0, useNativeDriver: false, tension: 80, friction: 10 }).start();
  }, [value]);
  const bg = anim.interpolate({ inputRange: [0, 1], outputRange: ["#D4C9B0", SB.teal] });
  const tx = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });
  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.85}>
      <Animated.View style={[tog.track, { backgroundColor: bg }]}>
        <Animated.View style={[tog.knob, { transform: [{ translateX: tx }] }]} />
      </Animated.View>
    </TouchableOpacity>
  );
};
const tog = StyleSheet.create({
  track: { width: 46, height: 26, borderRadius: 13, justifyContent: "center" },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
});

// ── Memory Card (polaroid) ────────────────────────────────────────────────

const MemoryCard = ({
  memory, caveat, onPress, onMenu,
}: {
  memory: ScrapbookMemory;
  caveat: (bold?: boolean) => string | undefined;
  onPress: () => void;
  onMenu: () => void;
}) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const photoUri = memory.cover_photo_url || memory.photos?.[0]?.photo_url;
  const rotation = `${getCardRotation(memory.id)}deg`;
  const activeStickerKeys = memory.stickers?.slice(0, 3) || [];

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[mc.wrap, { transform: [{ rotate: rotation }] }]}
    >
      {/* Photo area */}
      <View style={mc.photoArea}>
        {!imgLoaded && (
          <View style={mc.photoPlaceholder}>
            {!photoUri && (
              <Image source={require("../../assets/icon.png")} style={mc.iconPlaceholder} resizeMode="contain" />
            )}
            {photoUri && <ActivityIndicator color={SB.border} />}
          </View>
        )}
        {photoUri && (
          <Image
            source={{ uri: photoUri }}
            style={[StyleSheet.absoluteFillObject, !imgLoaded && { opacity: 0 }]}
            resizeMode="cover"
            onLoad={() => setImgLoaded(true)}
          />
        )}

        {/* Visibility badge */}
        <View style={[mc.badge, memory.is_public ? mc.badgePublic : mc.badgePrivate]}>
          <Text style={[mc.badgeText, { color: memory.is_public ? SB.tealText : SB.inkFaint, fontFamily: caveat(false) }]}>
            {memory.is_public ? "on profile" : "private"}
          </Text>
        </View>

        {/* ··· menu */}
        <TouchableOpacity style={mc.menuBtn} onPress={onMenu} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={mc.menuDots}>···</Text>
        </TouchableOpacity>
      </View>

      {/* Caption zone */}
      <View style={mc.body}>
        <Text style={[mc.title, { fontFamily: caveat(true) }]} numberOfLines={2}>
          {memory.title}
        </Text>
        <Text style={mc.meta}>
          {[memory.partner_name && `with ${memory.partner_name}`, formatDate(memory.activity_date)]
            .filter(Boolean).join(" · ")}
        </Text>
        {activeStickerKeys.length > 0 && (
          <View style={mc.stickerRow}>
            {activeStickerKeys.map(k => {
              const s = STICKERS.find(s => s.key === k);
              return s ? (
                <View key={k} style={[mc.stickerPill, { backgroundColor: s.bg, borderColor: s.border }]}>
                  <Text style={[mc.stickerText, { color: s.text, fontWeight: s.fontWeight as any }]}>{s.label}</Text>
                </View>
              ) : null;
            })}
            {memory.stickers.length > 3 && (
              <View style={[mc.stickerPill, { backgroundColor: SB.borderLight, borderColor: SB.border }]}>
                <Text style={[mc.stickerText, { color: SB.inkMuted }]}>+{memory.stickers.length - 3}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const mc = StyleSheet.create({
  wrap: {
    width: CARD_W, backgroundColor: "#fff",
    borderWidth: 0.5, borderColor: SB.border, borderRadius: 8,
    marginBottom: 28, alignSelf: "center",
    ...SB.cardShadow,
  },
  photoArea: {
    width: "100%", height: 220,
    borderTopLeftRadius: 8, borderTopRightRadius: 8, overflow: "hidden",
    backgroundColor: SB.cream,
  },
  photoPlaceholder: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: SB.cream },
  iconPlaceholder: { width: 48, height: 48, opacity: 0.35 },
  badge: {
    position: "absolute", top: 10, right: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20, borderWidth: 0.5,
  },
  badgePublic: { backgroundColor: SB.tealLight, borderColor: SB.teal },
  badgePrivate: { backgroundColor: "#F5F0E8", borderColor: SB.border },
  badgeText: { fontSize: 9 },
  menuBtn: {
    position: "absolute", bottom: 10, right: 10,
    backgroundColor: "rgba(0,0,0,0.22)", borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  menuDots: { fontSize: 11, color: "#fff", letterSpacing: 1 },
  body: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, gap: 4 },
  title: { fontSize: 20, color: SB.ink },
  meta: { fontSize: 12, color: SB.inkMuted },
  stickerRow: { flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" },
  stickerPill: { borderWidth: 0.5, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  stickerText: { fontSize: 11, fontWeight: "600", fontFamily: "Quicksand_600SemiBold" },
});

// ── Memory Detail Modal ───────────────────────────────────────────────────

const MemoryDetailModal = ({
  memory: init, caveat, onClose,
}: {
  memory: ScrapbookMemory;
  caveat: (bold?: boolean) => string | undefined;
  onClose: (updated?: Partial<ScrapbookMemory>) => void;
}) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const captureRef = useRef<ViewShot>(null);

  const [title, setTitle] = useState(init.title);
  const [caption, setCaption] = useState(init.caption || "");
  const [stickers, setStickers] = useState<string[]>(init.stickers || []);
  const [isPublic, setIsPublic] = useState(init.is_public);
  const [photos, setPhotos] = useState<ScrapbookPhoto[]>(init.photos || []);
  const [uploading, setUploading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [fullPhoto, setFullPhoto] = useState<string | null>(null);
  const [saveTick, setSaveTick] = useState(new Animated.Value(0));
  const [confirmAnim] = useState(new Animated.Value(0));
  const [confirmText, setConfirmText] = useState("");
  const sunnyModalText = useRef<string | null>(null);
  const sunnyModalOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getSunnyResponse({
      context: "tandemComplete",
      activityTitle: init.title,
      partnerName: init.partner_name,
    }).then(text => {
      sunnyModalText.current = text;
      setTimeout(() => {
        Animated.timing(sunnyModalOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      }, 800);
    });
  }, []);

  const flashSaved = () => {
    setSaveTick(new Animated.Value(1));
    Animated.timing(saveTick, { toValue: 0, duration: 1200, delay: 200, useNativeDriver: true }).start();
  };
  const flashConfirm = (text: string) => {
    setConfirmText(text);
    confirmAnim.setValue(1);
    Animated.timing(confirmAnim, { toValue: 0, duration: 1500, delay: 400, useNativeDriver: true }).start();
  };

  const upsertField = async (fields: Record<string, any>) => {
    if (!user) return;
    await supabase.from("scrapbook_memories").upsert({ id: init.id, user_id: user.id, ...fields }, { onConflict: "id" });
  };

  const saveTitle = async () => { await upsertField({ title }); flashSaved(); };
  const saveCaption = async () => { if (caption !== init.caption) { await upsertField({ caption }); flashSaved(); } };

  const toggleSticker = async (key: string) => {
    const next = stickers.includes(key) ? stickers.filter(k => k !== key) : [...stickers, key];
    setStickers(next);
    await upsertField({ stickers: next });
  };

  const togglePublic = async () => {
    const next = !isPublic;
    setIsPublic(next);
    await upsertField({ is_public: next });
    flashConfirm(next ? "showing on your profile" : "kept private");
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("permission needed", "allow photo access to add photos."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (result.canceled || !result.assets?.[0]) return;
    const localUri = result.assets[0].uri;
    setUploading(true);
    try {
      const fileName = `${user?.id || "anon"}/${init.id}/${Date.now()}.jpg`;
      const res = await fetch(localUri);
      const blob = await res.blob();
      const { error } = await supabase.storage.from("scrapbook-photos").upload(fileName, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      const publicUrl = supabase.storage.from("scrapbook-photos").getPublicUrl(fileName).data.publicUrl;
      const newPhoto = { photo_url: publicUrl, display_order: photos.length };
      await supabase.from("scrapbook_photos").insert({ memory_id: init.id, ...newPhoto });
      if (photos.length === 0) await upsertField({ cover_photo_url: publicUrl });
      setPhotos(prev => [...prev, newPhoto]);
    } catch { Alert.alert("upload failed", "couldn't save the photo. try again?"); }
    setUploading(false);
  };

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const uri = await (captureRef.current as any)?.capture?.();
      if (!uri) throw new Error("capture failed");
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === "granted") await MediaLibrary.saveToLibraryAsync(uri);
      await Sharing.shareAsync(uri, { mimeType: "image/jpeg" });
    } catch { Alert.alert("couldn't share", "something went wrong. try again?"); }
    setSharing(false);
  };

  // Photo collage layout
  const renderCollage = () => {
    const canAdd = photos.length < 4;
    const PhotoWrap = ({ uri, style }: { uri: string; style: any }) => (
      <TouchableOpacity
        style={[{ backgroundColor: "#fff", padding: 3 }, style]}
        onPress={() => setFullPhoto(uri)}
        activeOpacity={0.85}
      >
        <Image source={{ uri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      </TouchableOpacity>
    );
    const AddBtn = ({ style }: { style: any }) => (
      <TouchableOpacity style={[{ backgroundColor: SB.borderLight, alignItems: "center", justifyContent: "center" }, style]} onPress={pickPhoto} activeOpacity={0.8}>
        {uploading ? <ActivityIndicator color={SB.inkMuted} /> : <Text style={{ fontSize: 24, color: SB.inkMuted }}>+</Text>}
      </TouchableOpacity>
    );

    if (photos.length === 0) return (
      <View style={col.one}>
        <View style={[col.one, { alignItems: "center", justifyContent: "center", backgroundColor: SB.cream }]}>
          <Image source={require("../../assets/icon.png")} style={{ width: 48, height: 48, opacity: 0.3 }} resizeMode="contain" />
        </View>
        {canAdd && <AddBtn style={col.one} />}
      </View>
    );
    if (photos.length === 1) return (
      <View style={{ gap: 4 }}>
        <PhotoWrap uri={photos[0].photo_url} style={col.one} />
        {canAdd && <AddBtn style={col.one} />}
      </View>
    );
    if (photos.length === 2) return (
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: "row", gap: 4 }}>
          <PhotoWrap uri={photos[0].photo_url} style={col.half} />
          <PhotoWrap uri={photos[1].photo_url} style={col.half} />
        </View>
        {canAdd && <AddBtn style={col.one} />}
      </View>
    );
    return (
      <View style={{ gap: 4 }}>
        <PhotoWrap uri={photos[0].photo_url} style={col.top} />
        <View style={{ flexDirection: "row", gap: 4 }}>
          {photos.slice(1).map((p, i) => <PhotoWrap key={i} uri={p.photo_url} style={col.third} />)}
          {canAdd && <AddBtn style={col.third} />}
        </View>
      </View>
    );
  };

  return (
    <Modal visible animationType="slide" onRequestClose={() => onClose({ title, caption, stickers, is_public: isPublic, photos })}>
      <View style={[dm.container, { paddingTop: insets.top }]}>
        {/* Top bar */}
        <View style={dm.topBar}>
          <TouchableOpacity onPress={() => onClose({ title, caption, stickers, is_public: isPublic, photos })} activeOpacity={0.7}>
            <Text style={dm.backBtn}>← back</Text>
          </TouchableOpacity>
          <Text style={[dm.topTitle, { fontFamily: caveat(true) }]} numberOfLines={1}>{init.title}</Text>
          <TouchableOpacity onPress={handleShare} activeOpacity={0.7}>
            {sharing ? <ActivityIndicator size="small" color={SB.teal} /> : <Text style={dm.shareBtn}>share</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[dm.scroll, { paddingBottom: insets.bottom + 40 }]}>
          {/* Capture zone */}
          <ViewShot ref={captureRef} options={{ format: "jpg", quality: 0.92 }} style={dm.captureZone}>
            {renderCollage()}
            {/* Active stickers on capture */}
            {stickers.length > 0 && (
              <View style={dm.captureStickers}>
                {stickers.map(k => {
                  const s = STICKERS.find(s => s.key === k);
                  return s ? (
                    <View key={k} style={[dm.captureStickerPill, { backgroundColor: s.bg, borderColor: s.border }]}>
                      <Text style={[dm.captureStickerText, { color: s.text }]}>{s.label}</Text>
                    </View>
                  ) : null;
                })}
              </View>
            )}
            <View style={dm.captureFooter}>
              <Text style={[dm.captureTitle, { fontFamily: caveat(true) }]}>{title}</Text>
              <Text style={dm.captureMeta}>
                {[init.partner_name && `with ${init.partner_name}`, formatDate(init.activity_date)].filter(Boolean).join(" · ")}
              </Text>
              <View style={dm.captureStamp}>
                <Image source={require("../../assets/icon.png")} style={{ width: 18, height: 18, opacity: 0.45 }} resizeMode="contain" />
                <Text style={dm.captureStampText}>tandem</Text>
              </View>
            </View>
          </ViewShot>

          {/* Profile visibility banner */}
          <View style={[dm.visibilityBanner, { backgroundColor: isPublic ? SB.tealLight : "#F5F0E8", borderColor: isPublic ? SB.teal : SB.border }]}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 }}>
              <Ionicons name="eye-outline" size={16} color={SB.teal} />
              <View style={{ flex: 1 }}>
                <Text style={dm.visLabel}>show on my profile</Text>
                <Text style={dm.visSub}>people viewing your profile can see this</Text>
              </View>
            </View>
            <AnimatedToggle value={isPublic} onToggle={togglePublic} />
          </View>
          <Animated.Text style={[dm.visConfirm, { fontFamily: caveat(false), opacity: confirmAnim }]}>
            {confirmText}
          </Animated.Text>

          {/* Memory metadata */}
          <View style={dm.card}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <TextInput
                style={[dm.titleInput, { fontFamily: caveat(true) }]}
                value={title}
                onChangeText={setTitle}
                onBlur={saveTitle}
                multiline={false}
              />
              <Animated.Text style={[dm.savedTick, { opacity: saveTick }]}>saved</Animated.Text>
            </View>
            <Text style={dm.metaSub}>
              {[init.partner_name && `with ${init.partner_name}`, formatDate(init.activity_date), init.location]
                .filter(Boolean).join(" · ")}
            </Text>
          </View>

          {/* Caption */}
          <View style={dm.card}>
            <TextInput
              style={[dm.captionInput, { fontFamily: caveat(false) }]}
              value={caption}
              onChangeText={setCaption}
              onBlur={saveCaption}
              placeholder="tap to add a note about this memory..."
              placeholderTextColor={SB.inkMuted}
              multiline
            />
          </View>

          {sunnyModalText.current ? (
            <Animated.Text style={[dm.sunnyLine, { opacity: sunnyModalOpacity }]} numberOfLines={2}>
              {sunnyModalText.current}
            </Animated.Text>
          ) : null}

          {/* Sticker strip */}
          <View style={dm.card}>
            <Text style={dm.sectionLabel}>add a sticker</Text>
            <View style={dm.stickerStrip}>
              {STICKERS.map(s => {
                const active = stickers.includes(s.key);
                return (
                  <TouchableOpacity
                    key={s.key}
                    onPress={() => toggleSticker(s.key)}
                    activeOpacity={0.75}
                    style={[dm.stickerBtn, active
                      ? { backgroundColor: s.bg, borderColor: s.border, transform: [{ scale: 1.05 }] }
                      : { backgroundColor: "#fff", borderColor: SB.border, opacity: 0.7 }
                    ]}
                  >
                    <Text style={[dm.stickerLabel, { color: active ? s.text : "#999", fontWeight: (s.fontWeight as any) }]}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Full-size photo viewer */}
      {fullPhoto && (
        <Modal visible animationType="fade" onRequestClose={() => setFullPhoto(null)}>
          <TouchableOpacity style={dm.fullPhotoOverlay} onPress={() => setFullPhoto(null)} activeOpacity={1}>
            <Image source={{ uri: fullPhoto }} style={dm.fullPhoto} resizeMode="contain" />
          </TouchableOpacity>
        </Modal>
      )}
    </Modal>
  );
};

const col = StyleSheet.create({
  one: { width: "100%", height: 200, borderRadius: 4, overflow: "hidden" },
  half: { flex: 1, height: 130, borderRadius: 4, overflow: "hidden" },
  top: { width: "100%", height: 130, borderRadius: 4, overflow: "hidden" },
  third: { flex: 1, height: 100, borderRadius: 4, overflow: "hidden" },
});

const dm = StyleSheet.create({
  container: { flex: 1, backgroundColor: SB.creamDeep },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: SB.border,
  },
  backBtn: { fontSize: 13, color: SB.teal, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", minWidth: 60 },
  topTitle: { flex: 1, fontSize: 16, color: SB.ink, textAlign: "center", marginHorizontal: 8 },
  shareBtn: { fontSize: 13, color: SB.teal, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", minWidth: 60, textAlign: "right" },
  scroll: { paddingHorizontal: 20, paddingTop: 16, gap: 14 },
  captureZone: { backgroundColor: SB.cream, borderRadius: 8, overflow: "hidden" },
  captureFooter: { padding: 14, gap: 4 },
  captureTitle: { fontSize: 18, color: SB.ink },
  captureMeta: { fontSize: 12, color: SB.inkMuted },
  captureStamp: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, opacity: 0.5 },
  captureStampText: { fontSize: 9, color: SB.inkMuted, letterSpacing: 1 },
  captureStickers: { flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingTop: 10, flexWrap: "wrap" },
  captureStickerPill: { borderWidth: 0.5, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  captureStickerText: { fontSize: 11, fontWeight: "600", fontFamily: "Quicksand_600SemiBold" },
  visibilityBanner: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 0.5, borderRadius: 12, padding: 14, gap: 12,
  },
  visLabel: { fontSize: 13, fontWeight: "500", fontFamily: "Quicksand_500Medium", color: SB.ink },
  visSub: { fontSize: 10, color: SB.inkMuted, marginTop: 2 },
  visConfirm: { fontSize: 12, color: SB.teal, fontStyle: "italic", marginTop: -8, paddingHorizontal: 2 },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: SB.border, borderRadius: 8, padding: 14, gap: 6 },
  titleInput: { flex: 1, fontSize: 18, color: SB.ink, padding: 0 },
  savedTick: { fontSize: 11, color: SB.teal },
  metaSub: { fontSize: 12, color: SB.inkMuted },
  captionInput: { fontSize: 14, color: SB.inkMid, lineHeight: 22, minHeight: 60 },
  sectionLabel: { fontSize: 10, color: SB.inkMuted, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", letterSpacing: 0.5 },
  stickerStrip: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  stickerBtn: { borderWidth: 0.5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  stickerLabel: { fontSize: 12, fontWeight: "600", fontFamily: "Quicksand_600SemiBold" },
  fullPhotoOverlay: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  fullPhoto: { width: W, height: W * 1.2 },
  sunnyLine: { fontStyle: "italic", fontSize: 13, color: "#888", textAlign: "center", paddingHorizontal: 20, paddingVertical: 4 },
});

// ── Timeline View ─────────────────────────────────────────────────────────

const TimelineView = ({
  memories, caveat, onPress, bottomPad,
}: {
  memories: ScrapbookMemory[];
  caveat: (bold?: boolean) => string | undefined;
  onPress: (m: ScrapbookMemory) => void;
  bottomPad: number;
}) => {
  const grouped: Record<string, ScrapbookMemory[]> = {};
  for (const m of memories) {
    const k = monthLabel(m.created_at);
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(m);
  }
  const sections = Object.entries(grouped).map(([title, data]) => ({ title, data }));

  return (
    <SectionList
      sections={sections}
      keyExtractor={m => m.id}
      stickySectionHeadersEnabled
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bottomPad }}
      renderSectionHeader={({ section: { title } }) => (
        <View style={tl.header}>
          <Text style={[tl.headerText, { fontFamily: caveat(true) }]}>{title}</Text>
        </View>
      )}
      renderItem={({ item: m }) => {
        const photoUri = m.cover_photo_url || m.photos?.[0]?.photo_url;
        return (
          <TouchableOpacity style={tl.row} onPress={() => onPress(m)} activeOpacity={0.85}>
            <View style={[tl.thumb, { transform: [{ rotate: `${getCardRotation(m.id)}deg` }] }]}>
              {photoUri
                ? <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                : <Image source={require("../../assets/icon.png")} style={tl.thumbIcon} resizeMode="contain" />}
            </View>
            <View style={tl.rowBody}>
              <Text style={[tl.rowTitle, { fontFamily: caveat(true) }]} numberOfLines={1}>{m.title}</Text>
              <Text style={tl.rowMeta}>
                {[m.partner_name && `with ${m.partner_name}`, formatDate(m.activity_date)].filter(Boolean).join(" · ")}
              </Text>
            </View>
            {m.is_public && <View style={tl.dot} />}
          </TouchableOpacity>
        );
      }}
    />
  );
};

const tl = StyleSheet.create({
  header: { backgroundColor: "#EDE6D6", paddingVertical: 8, paddingHorizontal: 16 },
  headerText: { fontSize: 15, color: SB.inkMuted },
  row: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8,
    backgroundColor: SB.cream,
    borderWidth: 1, borderColor: SB.border, borderRadius: 8,
    marginHorizontal: 16,
    ...SB.cardShadow,
  },
  thumb: {
    width: 52, height: 52, borderRadius: 4,
    backgroundColor: SB.amberLight, overflow: "hidden",
    borderWidth: 2, borderColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  thumbIcon: { width: 24, height: 24, opacity: 0.3 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 14, color: SB.ink },
  rowMeta: { fontSize: 11, color: SB.inkMuted },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: SB.teal },
});

// ── Empty State ───────────────────────────────────────────────────────────

const EmptyState = ({ caveat, onPost, sunnyLine, sunnyOpacity }: {
  caveat: (bold?: boolean) => string | undefined;
  onPost: () => void;
  sunnyLine?: string | null;
  sunnyOpacity: Animated.Value;
}) => (
  <View style={em.wrap}>
    <View style={em.polaroid}>
      <View style={em.photoArea}>
        <Image source={require("../../assets/icon.png")} style={{ width: 52, height: 52, opacity: 0.4 }} resizeMode="contain" />
      </View>
      <View style={em.body}>
        <Text style={[em.title, { fontFamily: caveat(true) }]}>your first memory is waiting</Text>
        <Text style={[em.desc, { fontFamily: caveat(false) }]}>go do something. i'll be here.</Text>
      </View>
    </View>
    {sunnyLine ? (
      <Animated.Text style={[em.sunnyLine, { opacity: sunnyOpacity }]} numberOfLines={2}>
        {sunnyLine}
      </Animated.Text>
    ) : null}
    <TouchableOpacity style={em.btn} activeOpacity={0.88} onPress={onPost}>
      <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={em.btnInner}>
        <Text style={em.btnText}>post an activity</Text>
      </LinearGradient>
    </TouchableOpacity>
  </View>
);

const em = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", paddingTop: 60, paddingHorizontal: 40, gap: 28 },
  polaroid: {
    width: W * 0.62, backgroundColor: "#fff",
    borderWidth: 1.5, borderStyle: "dashed", borderColor: "#D4C9B0", borderRadius: 8,
    ...SB.cardShadow,
  },
  photoArea: { height: 160, backgroundColor: SB.amberLight, alignItems: "center", justifyContent: "center", borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  body: { padding: 14, alignItems: "center", gap: 4 },
  title: { fontSize: 18, color: SB.inkMuted, textAlign: "center" },
  desc: { fontSize: 13, color: SB.inkMuted, textAlign: "center" },
  btn: { width: "100%", height: 52, borderRadius: radius.full, overflow: "hidden" },
  btnInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 15, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: "#fff" },
  sunnyLine: { fontStyle: "italic", fontSize: 13, color: "#888", textAlign: "center", paddingHorizontal: 8 },
});

// ── Main Screen ───────────────────────────────────────────────────────────

interface ScrapbookScreenProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
  onPostPress?: () => void;
}

export const ScrapbookScreen = ({ activeTab, onTabPress, onPostPress }: ScrapbookScreenProps) => {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({ Caveat_400Regular, Caveat_700Bold });
  const [viewMode, setViewMode] = useState<"grid" | "timeline">("grid");
  const [memories, setMemories] = useState<ScrapbookMemory[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<ScrapbookMemory | null>(null);
  const sunnyEmptyText = useRef<string | null>(null);
  const [sunnyEmptyVisible, setSunnyEmptyVisible] = useState(false);
  const sunnyEmptyOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (memories.length === 0) {
      getSunnyResponse({ context: "emptyScrapbook" }).then(text => {
        sunnyEmptyText.current = text;
        setTimeout(() => {
          setSunnyEmptyVisible(true);
          Animated.timing(sunnyEmptyOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
        }, 700);
      });
    }
  }, []);

  const caveat = useCallback(
    (bold?: boolean) => fontsLoaded ? (bold ? "Caveat_700Bold" : "Caveat_400Regular") : undefined,
    [fontsLoaded]
  );

  const handleMenu = (memory: ScrapbookMemory) => {
    const options = ["edit memory", "delete memory", "cancel"];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex: 1, cancelButtonIndex: 2 },
        idx => {
          if (idx === 0) setSelectedMemory(memory);
          if (idx === 1) {
            Alert.alert("delete memory?", "this can't be undone.", [
              { text: "cancel", style: "cancel" },
              {
                text: "delete", style: "destructive",
                onPress: async () => {
                  setMemories(prev => prev.filter(m => m.id !== memory.id));
                  await supabase.from("scrapbook_memories").delete().eq("id", memory.id);
                },
              },
            ]);
          }
        }
      );
    } else {
      Alert.alert(memory.title, undefined, [
        { text: "edit memory", onPress: () => setSelectedMemory(memory) },
        {
          text: "delete memory", style: "destructive",
          onPress: () => Alert.alert("delete?", "this can't be undone.", [
            { text: "cancel", style: "cancel" },
            { text: "delete", style: "destructive", onPress: async () => {
              setMemories(prev => prev.filter(m => m.id !== memory.id));
              await supabase.from("scrapbook_memories").delete().eq("id", memory.id);
            }},
          ]),
        },
        { text: "cancel", style: "cancel" },
      ]);
    }
  };

  const handleMemoryClosed = (updated?: Partial<ScrapbookMemory>) => {
    if (updated && selectedMemory) {
      setMemories(prev => prev.map(m => m.id === selectedMemory.id ? { ...m, ...updated } : m));
    }
    setSelectedMemory(null);
  };

  const bottomPad = 100 + insets.bottom;

  return (
    <View style={[sc.container]}>
      {/* Header */}
      <View style={[sc.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[sc.title, { fontFamily: caveat(true) }]}>scrapbook</Text>
        <View style={sc.headerRight}>
          <TouchableOpacity
            style={[sc.timelineBtn, viewMode === "timeline" && sc.timelineBtnActive]}
            onPress={() => setViewMode(v => v === "grid" ? "timeline" : "grid")}
            activeOpacity={0.75}
          >
            <Text style={[sc.timelineBtnText, viewMode === "timeline" && sc.timelineBtnTextActive]}>
              timeline
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={sc.addBtn}
            onPress={() => onPostPress?.()}
            activeOpacity={0.8}
          >
            <Text style={sc.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Body */}
      {viewMode === "timeline" ? (
        <TimelineView memories={memories} caveat={caveat} onPress={setSelectedMemory} bottomPad={bottomPad} />
      ) : memories.length === 0 ? (
        <EmptyState
          caveat={caveat}
          onPost={() => onPostPress?.()}
          sunnyLine={sunnyEmptyVisible ? sunnyEmptyText.current : null}
          sunnyOpacity={sunnyEmptyOpacity}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 24, paddingBottom: bottomPad }}
        >
          {memories.map(m => (
            <MemoryCard
              key={m.id}
              memory={m}
              caveat={caveat}
              onPress={() => setSelectedMemory(m)}
              onMenu={() => handleMenu(m)}
            />
          ))}
        </ScrollView>
      )}

      <BottomNav activeTab={activeTab} onTabPress={onTabPress} onPostPress={onPostPress} />

      {selectedMemory && (
        <MemoryDetailModal
          memory={selectedMemory}
          caveat={caveat}
          onClose={handleMemoryClosed}
        />
      )}
    </View>
  );
};

const sc = StyleSheet.create({
  container: { flex: 1, backgroundColor: SB.cream },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: SB.border,
    backgroundColor: SB.cream,
  },
  title: { fontSize: 26, color: SB.ink },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  timelineBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: SB.border,
  },
  timelineBtnActive: { backgroundColor: SB.tealLight, borderColor: SB.teal },
  timelineBtnText: { fontSize: 13, color: SB.inkMuted, fontWeight: "600", fontFamily: "Quicksand_600SemiBold" },
  timelineBtnTextActive: { color: SB.tealText },
  addBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: SB.teal, alignItems: "center", justifyContent: "center",
  },
  addBtnText: { fontSize: 20, color: "#fff", lineHeight: 24, marginTop: -1 },
});
