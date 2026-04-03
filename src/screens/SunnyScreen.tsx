// SUPABASE: Run this SQL if video_url column does not exist:
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS video_url text;
// NOTIFY pgrst, 'reload schema';

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Animated, KeyboardAvoidingView, Platform,
  Dimensions, Alert, Image, Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import SunnyAvatar, { SunnyExpression } from "../components/SunnyAvatar";
import { SplashAnimationScreen } from "./SplashAnimationScreen";
import { registerForPushNotifications } from "../lib/notifications";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { colors, radius, gradients, shadows } from "../theme";

const { width: SCREEN_W } = Dimensions.get("window");

// ─── Types ───────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  from: "sunny" | "user";
  text: string;
}

type ResponseMode = "text" | "voice" | "video";

// ─── Sunny Persona for LLM ───────────────────────────────────
const SUNNY_SYSTEM_PROMPT = `You are Sunny, the AI host of Tandem — a platonic social connection app where people find companions for activities. You have a warm, witty, slightly cheeky personality. You are NOT a therapist or assistant. You are more like that one friend who just gets people.

Your voice rules:
- Never use em dashes. Use commas or periods instead.
- Short messages only. 1-2 sentences max.
- Lowercase is fine, it's your style.
- No exclamation marks unless truly warranted.
- No filler phrases like "great!", "awesome!", "wonderful!"
- Be specific and genuine, not generic.
- You have genuine opinions and reactions.
- Occasionally playful or a little teasing, never mean.
- Never robotic, never formal, never corporate.

You are reacting to a user's onboarding answer. Give a short, genuine, human reaction (1-2 sentences max) that feels like a real person responded. Do NOT ask another question. Just react warmly and naturally.`;

// ─── Script (no em dashes, no emoji in options) ──────────────
const STEPS = [
  {
    key: "opening",
    messages: [
      "hi! I'm Sunny",
      "I basically run the show around here, in the best way possible",
      "my job is to find you people worth leaving the house for. but first I need to get to know you a little",
      "don't stress. I promise this won't feel like filling out a form. ready?",
    ],
    expression: "warm" as SunnyExpression,
    inputType: "single",
    options: ["let's go"],
  },
  {
    key: "name",
    messages: ["okay first things first. what do I call you?"],
    expression: "warm" as SunnyExpression,
    inputType: "text",
    placeholder: "Your first name",
  },
  {
    key: "photo",
    messages: ["let's put a face to the name. add a profile photo."],
    expression: "warm" as SunnyExpression,
    inputType: "photo",
  },
  {
    key: "birthday",
    messages: ["and when's your birthday?", "you have to be 18+ to be here. yes we check"],
    expression: "warm" as SunnyExpression,
    inputType: "birthday",
    placeholder: "MM/DD/YYYY",
  },
  {
    key: "gender",
    messages: ["how do you identify?"],
    expression: "warm" as SunnyExpression,
    inputType: "single",
    options: ["Man", "Woman", "Non-binary", "Prefer not to say", "Other"],
  },
  {
    key: "occupation",
    messages: ["what do you do?"],
    expression: "warm" as SunnyExpression,
    inputType: "text",
    placeholder: "Job, creative pursuit, professional napper...",
  },
  {
    key: "personality",
    messages: ["okay personality check. what's your MBTI?"],
    expression: "excited" as SunnyExpression,
    inputType: "single",
    options: [
      "INTJ", "INTP", "ENTJ", "ENTP",
      "INFJ", "INFP", "ENFJ", "ENFP",
      "ISTJ", "ISFJ", "ESTJ", "ESFJ",
      "ISTP", "ISFP", "ESTP", "ESFP",
      "I don't know",
    ],
  },
  {
    key: "humor",
    messages: ["how would you describe your humor? pick all that apply"],
    expression: "smirky" as SunnyExpression,
    inputType: "multi",
    options: ["Dry & deadpan", "Sarcastic", "Dark humor", "Witty & quick", "Absurdist", "Meme fluent", "Punny", "Wholesome"],
  },
  {
    key: "usage",
    messages: ["last one. why are you here? what are you actually looking for?"],
    expression: "warm" as SunnyExpression,
    inputType: "multi",
    options: ["Friendship", "Group activities", "Workout buddy", "Exploring the city", "Companionship", "Gaming buddy", "Travel buddy", "Study buddy"],
  },
  {
    key: "ideal_saturday",
    messages: ["okay quick ones. my ideal Saturday is..."],
    expression: "warm" as SunnyExpression,
    inputType: "single",
    options: [
      "A farmers market and zero plans",
      "A hike at dawn",
      "My couch and zero guilt",
      "Something spontaneous",
    ],
  },
  {
    key: "friend_who",
    messages: ["I'm the friend who..."],
    expression: "warm" as SunnyExpression,
    inputType: "single",
    options: [
      "Plans the group chat",
      "Shows up with snacks",
      "Gets everyone lost (on purpose)",
      "Sends memes at 2am",
    ],
  },
  {
    key: "deep_prompt",
    messages: [
      "okay now the real ones.",
      "pick a prompt. finish it your way.",
    ],
    expression: "warm" as SunnyExpression,
    inputType: "prompt_pick",
    options: [
      "You'll know we'll get along if...",
      "The thing most people don't know about me is...",
      "I'm at my best when...",
    ],
    placeholder: "finish the sentence...",
  },
  {
    key: "done",
    messages: [
      "okay that's it. you did great",
      "I already have people in mind for you",
      "let's get you in there.",
    ],
    expression: "celebratory" as SunnyExpression,
    inputType: "single",
    options: ["let's go"],
  },
];

// Steps where skip is NOT allowed
const UNSKIPPABLE = new Set(["opening", "name", "birthday", "done"]);

// Fallback reactions if LLM fails — specific per known answer
const FALLBACK_REACTIONS: Record<string, { message: string; expression: SunnyExpression }> = {
  "let's go": { message: "okay! let's do this", expression: "excited" },
  "A hike at dawn": { message: "okay yes. I have people for you", expression: "excited" },
  "My couch and zero guilt": { message: "I respect it. we'll find you people who get it", expression: "warm" },
  "Something spontaneous": { message: "I love that energy", expression: "excited" },
  "Plans the group chat": { message: "we need you", expression: "excited" },
  "Shows up with snacks": { message: "honestly the most important role", expression: "proud" },
  "Gets everyone lost (on purpose)": { message: "chaotic. I love it", expression: "smirky" },
  "Sends memes at 2am": { message: "a person of culture", expression: "smirky" },
};

// Generic fallbacks used when no specific match and LLM fails
const MULTI_FALLBACKS: { message: string; expression: SunnyExpression }[] = [
  { message: "okay I see you", expression: "warm" },
  { message: "noted. already thinking of people", expression: "excited" },
  { message: "love that", expression: "warm" },
  { message: "that tracks", expression: "smirky" },
  { message: "filing that away", expression: "warm" },
  { message: "good to know", expression: "warm" },
];

const getGenericFallback = () =>
  MULTI_FALLBACKS[Math.floor(Math.random() * MULTI_FALLBACKS.length)];

const PROGRESS_MAP: Record<number, number> = {
  0: 8, 1: 18, 2: 28, 3: 36, 4: 44, 5: 52,
  6: 60, 7: 68, 8: 76, 9: 84, 10: 92, 11: 100,
};

// ─── LLM Reaction Helper ─────────────────────────────────────
const getSunnyReaction = async (
  userAnswer: string,
  questionKey: string,
  userName: string,
): Promise<{ message: string; expression: SunnyExpression }> => {
  const name = userName || "you";

  const reactions: Record<string, { message: string; expression: SunnyExpression }> = {
    name: { message: `love that name.`, expression: "warm" },
    birthday: { message: `noted.`, expression: "warm" },
    gender: { message: `got it.`, expression: "warm" },
    occupation: { message: `interesting. bet there's a story there.`, expression: "warm" },
    personality: { message: `that actually makes a lot of sense for you.`, expression: "warm" },
    humor: { message: `good taste. we're going to get along.`, expression: "smirky" },
    usage: { message: `you're in the right place.`, expression: "warm" },
    ideal_saturday: { message: `honestly that sounds like exactly the kind of day tandem was built for.`, expression: "excited" },
    friend_who: { message: `that person exists. and they're probably already looking for someone like you.`, expression: "proud" },
    deep_prompt: { message: `okay i didn't expect that. in the best way.`, expression: "warm" },
    done: { message: `alright. your people are out there. let's go find them.`, expression: "celebratory" },
  };

  const reaction = reactions[questionKey];
  if (reaction) return reaction;
  return { message: "that's good to know.", expression: "warm" };
};

// ─── Typing Indicator ─────────────────────────────────────────
const TypingIndicator = () => {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, { toValue: -5, duration: 250, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 250, useNativeDriver: true }),
          Animated.delay(300),
        ])
      )
    );
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, []);

  return (
    <View style={styles.typingRow}>
      <View style={styles.typingBubble}>
        {dots.map((dot, i) => (
          <Animated.View
            key={i}
            style={[styles.typingDot, { transform: [{ translateY: dot }] }]}
          />
        ))}
      </View>
    </View>
  );
};

// ─── Message Bubble ───────────────────────────────────────────
const MessageBubble = ({
  message, showAvatar, expression, isTalking,
}: {
  message: ChatMessage;
  showAvatar: boolean;
  expression: SunnyExpression;
  isTalking: boolean;
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);

  const isSunny = message.from === "sunny";

  return (
    <Animated.View
      style={[
        styles.bubbleRow,
        !isSunny && styles.bubbleRowUser,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {isSunny && (
        <View style={[styles.avatarSlot, !showAvatar && { opacity: 0 }]}>
          {showAvatar && (
            <SunnyAvatar expression={expression} size={32} isTalking={isTalking} />
          )}
        </View>
      )}
      {isSunny ? (
        <View style={styles.sunnyBubble}>
          <Text style={styles.sunnyBubbleText}>{message.text}</Text>
        </View>
      ) : (
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.userBubble}
        >
          <Text style={styles.userBubbleText}>{message.text}</Text>
        </LinearGradient>
      )}
    </Animated.View>
  );
};

// ─── Option Chips (mobile-friendly compact layout) ────────────
const GRID_CHIP_W = (SCREEN_W - 24 - 18) / 4;

const OptionChips = ({
  options, multiSelect, selected, onSelect, onDone, gridMode,
}: {
  options: string[];
  multiSelect?: boolean;
  selected: string[];
  onSelect: (v: string) => void;
  onDone?: () => void;
  gridMode?: boolean;
}) => {
  const mainOptions = gridMode ? options.slice(0, -1) : options;
  const lastOption = gridMode ? options[options.length - 1] : null;

  const renderChip = (opt: string, extraStyle?: object) => {
    const isSelected = selected.includes(opt);
    return (
      <TouchableOpacity
        key={opt}
        onPress={() => onSelect(opt)}
        activeOpacity={0.8}
        style={[
          styles.optionChip,
          isSelected && styles.optionChipSelected,
          gridMode && { width: GRID_CHIP_W, height: 44, justifyContent: "center", alignItems: "center" },
          extraStyle,
        ]}
      >
        {isSelected ? (
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.optionChipGradient, gridMode && { flex: 1, width: "100%", alignItems: "center", justifyContent: "center" }]}
          >
            <Text style={[styles.optionChipTextSelected, gridMode && { fontSize: 12 }]}>{opt}</Text>
          </LinearGradient>
        ) : (
          <Text style={[styles.optionChipText, gridMode && { fontSize: 12 }]}>{opt}</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
  <View style={styles.chipsContainer}>
    <ScrollView
      horizontal={false}
      showsVerticalScrollIndicator={false}
      style={styles.chipsScrollArea}
    >
      <View style={[styles.chipsWrap, gridMode && { gap: 6 }]}>
        {mainOptions.map(opt => renderChip(opt))}
      </View>
      {gridMode && lastOption && (
        <View style={{ marginTop: 6 }}>
          {renderChip(lastOption, { width: "100%" as any })}
        </View>
      )}
    </ScrollView>

    {multiSelect && onDone && (
      <TouchableOpacity
        onPress={onDone}
        activeOpacity={0.88}
        style={[styles.doneBtn, selected.length === 0 && styles.doneBtnDisabled]}
        disabled={selected.length === 0}
      >
        <LinearGradient
          colors={selected.length > 0 ? gradients.brand : [colors.surface, colors.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.doneBtnInner}
        >
          <Text
            style={[styles.doneBtnText, selected.length === 0 && styles.doneBtnTextDisabled]}
          >
            {selected.length > 0 ? `Done (${selected.length} selected)` : "Select at least one"}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    )}
  </View>
  );
};

// ─── Birthday Input (auto-formats MM/DD/YYYY) ─────────────────
const BirthdayInput = ({ onSubmit }: { onSubmit: (v: string) => void }) => {
  const [value, setValue] = useState("");

  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    let formatted = "";

    if (digits.length <= 2) {
      formatted = digits;
    } else if (digits.length <= 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
    }

    setValue(formatted);
  };

  const isComplete = value.length === 10;

  return (
    <View style={styles.textInputContainer}>
      <View style={styles.textInputRow}>
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={handleChange}
          placeholder="MM/DD/YYYY"
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
          maxLength={10}
          returnKeyType="done"
          onSubmitEditing={() => { if (isComplete) onSubmit(value); }}
          autoFocus
        />
        <TouchableOpacity
          onPress={() => { if (isComplete) onSubmit(value); }}
          disabled={!isComplete}
          activeOpacity={0.88}
          style={styles.sendBtn}
        >
          <LinearGradient
            colors={isComplete ? gradients.brand : [colors.surface, colors.surface]}
            style={styles.sendBtnInner}
          >
            <Ionicons
              name="arrow-up"
              size={18}
              color={isComplete ? colors.white : colors.muted}
            />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Prompt Input (text + voice + video) ─────────────────────
const PromptInput = ({
  placeholder, onSubmit, userId,
}: {
  placeholder?: string;
  onSubmit: (v: string, mode: ResponseMode) => void;
  userId?: string;
}) => {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<ResponseMode>("text");
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
    };
  }, []);

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleVoice = async () => {
    if (isRecording) {
      // Stop recording
      stopTimer();
      setIsRecording(false);
      const recording = recordingRef.current;
      recordingRef.current = null;
      if (!recording) return;
      try {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        if (!uri) {
          Alert.alert("Recording failed", "Could not read the recording. Please try again.");
          return;
        }

        let submitUri = uri;
        if (userId) {
          try {
            const timestamp = Date.now();
            const path = `${userId}/${timestamp}.m4a`;
            const response = await fetch(uri);
            const blob = await response.blob();
            const { error } = await supabase.storage
              .from("deep-prompt-media")
              .upload(path, blob, { contentType: "audio/m4a", upsert: true });
            if (!error) {
              const { data: urlData } = supabase.storage.from("deep-prompt-media").getPublicUrl(path);
              submitUri = urlData.publicUrl;
            } else {
              console.warn("Voice upload failed:", error.message);
            }
          } catch (uploadErr) {
            console.warn("Voice upload error:", uploadErr);
          }
        }

        onSubmit(submitUri, "voice");
      } catch (err: any) {
        Alert.alert(
          "Recording failed",
          err.message || "Could not save your voice memo. Type your answer instead."
        );
      }
      return;
    }

    // Start recording
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "microphone access needed",
        "go to Settings → Tandem → allow Microphone, then try again."
      );
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setElapsedSeconds(0);
      setIsRecording(true);
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    } catch (err: any) {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      Alert.alert(
        "couldn't start recording",
        "close other apps using the microphone and try again."
      );
    }
  };

  const handleVideo = async () => {
    try {
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      if (cameraPermission.status !== "granted") {
        Alert.alert(
          "camera access needed",
          "go to Settings → Tandem → allow Camera, then try again."
        );
        return;
      }

      const micPermission = await Audio.requestPermissionsAsync();
      if (micPermission.status !== "granted") {
        Alert.alert(
          "microphone access needed",
          "go to Settings → Tandem → allow Microphone, then try again."
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        videoMaxDuration: 30,
        allowsEditing: false,
        quality: 0.7,
      });

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      // Upload to Supabase storage
      if (userId) {
        try {
          const timestamp = Date.now();
          const path = `${userId}/${timestamp}.mp4`;
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          await supabase.storage
            .from("videos")
            .upload(path, blob, { contentType: "video/mp4", upsert: true });

          const { data: urlData } = supabase.storage.from("videos").getPublicUrl(path);
          if (urlData?.publicUrl) {
            await supabase
              .from("profiles")
              .update({ video_url: urlData.publicUrl } as any)
              .eq("user_id", userId);
          }
        } catch (uploadErr) {
          console.warn("Video upload error:", uploadErr);
        }
      }

      onSubmit(asset.uri, "video");
    } catch (err: any) {
      Alert.alert(
        "video recording failed",
        err.message || "something went wrong. try again."
      );
    }
  };

  return (
    <View style={styles.textInputContainer}>
      {/* Mode selector */}
      <View style={styles.modeSelector}>
        {(["text", "voice", "video"] as ResponseMode[]).map(m => (
          <TouchableOpacity
            key={m}
            onPress={() => { if (!isRecording) setMode(m); }}
            style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
            activeOpacity={0.75}
          >
            <Ionicons
              name={m === "text" ? "text" : m === "voice" ? "mic-outline" : "videocam-outline"}
              size={14}
              color={mode === m ? colors.teal : colors.muted}
            />
            <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
              {m}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === "text" ? (
        <View style={styles.textInputRow}>
          <TextInput
            style={styles.textInput}
            value={value}
            onChangeText={setValue}
            placeholder={placeholder || "Type here..."}
            placeholderTextColor={colors.muted}
            onSubmitEditing={() => { if (value.trim()) { onSubmit(value.trim(), "text"); setValue(""); } }}
            returnKeyType="send"
            autoFocus
            multiline
          />
          <TouchableOpacity
            onPress={() => { if (value.trim()) { onSubmit(value.trim(), "text"); setValue(""); } }}
            disabled={!value.trim()}
            activeOpacity={0.88}
            style={styles.sendBtn}
          >
            <LinearGradient
              colors={value.trim() ? gradients.brand : [colors.surface, colors.surface]}
              style={styles.sendBtnInner}
            >
              <Ionicons
                name="arrow-up"
                size={18}
                color={value.trim() ? colors.white : colors.muted}
              />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : mode === "voice" ? (
        isRecording ? (
          <View style={styles.recordingActive}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingTimer}>{formatElapsed(elapsedSeconds)}</Text>
            <TouchableOpacity onPress={handleVoice} style={styles.stopRecordingBtn} activeOpacity={0.88}>
              <Text style={styles.stopRecordingText}>Stop</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={handleVoice} style={styles.mediaBtn} activeOpacity={0.88}>
            <LinearGradient colors={gradients.brand} style={styles.mediaBtnInner}>
              <Ionicons name="mic" size={22} color={colors.white} />
              <Text style={styles.mediaBtnText}>Tap to record</Text>
            </LinearGradient>
          </TouchableOpacity>
        )
      ) : (
        <TouchableOpacity onPress={handleVideo} style={styles.mediaBtn} activeOpacity={0.88}>
          <LinearGradient colors={gradients.brand} style={styles.mediaBtnInner}>
            <Ionicons name="videocam" size={22} color={colors.white} />
            <Text style={styles.mediaBtnText}>Record a video</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Standard Text Input ──────────────────────────────────────
const ChatTextInput = ({
  placeholder, onSubmit,
}: {
  placeholder?: string;
  onSubmit: (v: string) => void;
}) => {
  const [value, setValue] = useState("");

  return (
    <View style={styles.textInputContainer}>
      <View style={styles.textInputRow}>
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={setValue}
          placeholder={placeholder || "Type here..."}
          placeholderTextColor={colors.muted}
          onSubmitEditing={() => { if (value.trim()) { onSubmit(value.trim()); setValue(""); } }}
          returnKeyType="send"
          autoFocus
        />
        <TouchableOpacity
          onPress={() => { if (value.trim()) { onSubmit(value.trim()); setValue(""); } }}
          disabled={!value.trim()}
          activeOpacity={0.88}
          style={styles.sendBtn}
        >
          <LinearGradient
            colors={value.trim() ? gradients.brand : [colors.surface, colors.surface]}
            style={styles.sendBtnInner}
          >
            <Ionicons
              name="arrow-up"
              size={18}
              color={value.trim() ? colors.white : colors.muted}
            />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────
interface SunnyScreenProps {
  onComplete: (data: Record<string, any>) => void;
}

export const SunnyScreen = ({ onComplete }: SunnyScreenProps) => {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const [showWalkthrough, setShowWalkthrough] = useState<boolean | null>(null);
  const [walkthroughSlide, setWalkthroughSlide] = useState(0);
  const walkthroughFade = useRef(new Animated.Value(1)).current;
  const [showSplash, setShowSplash] = useState<boolean | null>(null);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [pendingCompleteData, setPendingCompleteData] = useState<Record<string, any> | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [messagesShown, setMessagesShown] = useState(0);
  const [expression, setExpression] = useState<SunnyExpression>("warm");
  const [isTalking, setIsTalking] = useState(false);
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [profileData, setProfileData] = useState<Record<string, any>>({});
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [userName, setUserName] = useState("");
  const [deepPromptQuestion, setDeepPromptQuestion] = useState<string | null>(null);
  const [showAgeGate, setShowAgeGate] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const progressAnim = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    AsyncStorage.getItem("hasSeenWalkthrough").then(val => {
      if (val === "true") {
        setShowWalkthrough(false);
      } else {
        setShowWalkthrough(true);
        AsyncStorage.setItem("hasSeenWalkthrough", "true");
      }
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("splash_shown").then(val => {
      setShowSplash(!val);
    });
  }, []);

  const WALKTHROUGH_SLIDES = [
    { headline: "Never Go Alone." },
    { headline: "The activity is the icebreaker." },
    { headline: "The companion makes the memory." },
  ];

  const advanceWalkthrough = () => {
    Animated.timing(walkthroughFade, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      if (walkthroughSlide >= WALKTHROUGH_SLIDES.length - 1) {
        setShowWalkthrough(false);
      } else {
        setWalkthroughSlide(prev => prev + 1);
        Animated.timing(walkthroughFade, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }
    });
  };

  const step = STEPS[stepIndex];
  const isShowingInput = messagesShown >= step.messages.length;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: PROGRESS_MAP[stepIndex] || 8,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [stepIndex]);

  useEffect(() => {
    if (messagesShown >= step.messages.length) return;

    setIsTyping(true);
    const delay = messagesShown === 0 ? 400 : 800;

    const timer = setTimeout(() => {
      setIsTyping(false);
      setIsTalking(true);
      const msg = step.messages[messagesShown].replace("[Name]", userName || "you");
      setMessages(prev => [
        ...prev,
        { id: `${stepIndex}-${messagesShown}`, from: "sunny", text: msg },
      ]);
      setTimeout(() => setIsTalking(false), 1200);
      setMessagesShown(n => n + 1);
    }, delay);

    return () => clearTimeout(timer);
  }, [messagesShown, stepIndex]);

  useEffect(() => {
    if (step.expression) setExpression(step.expression);
    setSelectedChips([]);
    setDeepPromptQuestion(null);
  }, [stepIndex]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length, isTyping]);

  const addUserMessage = (text: string) => {
    setMessages(prev => [
      ...prev,
      { id: `user-${Date.now()}`, from: "user", text },
    ]);
  };

  const goNextStep = useCallback(() => {
    if (stepIndex >= STEPS.length - 1) {
      onComplete(profileData);
      return;
    }
    setStepIndex(i => i + 1);
    setMessagesShown(0);
  }, [stepIndex, profileData, onComplete]);

  const advanceWithReaction = useCallback(
    async (userAnswer: string, questionKey: string, skipReaction = false) => {
      if (skipReaction) {
        goNextStep();
        return;
      }

      setIsTyping(true);
      const reaction = await getSunnyReaction(userAnswer, questionKey, userName);
      setIsTyping(false);
      setExpression(reaction.expression);
      setIsTalking(true);
      setMessages(prev => [
        ...prev,
        { id: `sunny-react-${Date.now()}`, from: "sunny", text: reaction.message },
      ]);
      setTimeout(() => {
        setIsTalking(false);
        goNextStep();
      }, 1000);
    },
    [userName, goNextStep]
  );

  const handleSingleSelect = (value: string) => {
    addUserMessage(value);
    const data = { ...profileData, [step.key]: value };
    setProfileData(data);

    if (step.key === "done") {
      setPendingCompleteData(data);
      setTimeout(() => setShowNotifPrompt(true), 800);
      return;
    }

    if (value === "let's go" && step.key === "opening") {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setExpression("excited");
        setIsTalking(true);
        setMessages(prev => [
          ...prev,
          { id: `sunny-react-${Date.now()}`, from: "sunny", text: "okay! let's do this" },
        ]);
        setTimeout(() => {
          setIsTalking(false);
          goNextStep();
        }, 1000);
      }, 600);
      return;
    }

    advanceWithReaction(value, step.key);
  };

  const handleTextSubmit = async (value: string) => {
    addUserMessage(value);
    const data = { ...profileData, [step.key]: value };
    setProfileData(data);

    if (step.key === "name") {
      setUserName(value);
      const nameValue = value;
      if (nameValue) {
        await supabase.auth.updateUser({
          data: { first_name: nameValue, full_name: nameValue },
        });
      }
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setExpression("excited");
        setIsTalking(true);
        setMessages(prev => [
          ...prev,
          {
            id: `sunny-react-${Date.now()}`,
            from: "sunny",
            text: `${value}! okay I already have a feeling about you`,
          },
        ]);
        setTimeout(() => {
          setIsTalking(false);
          goNextStep();
        }, 1000);
      }, 600);
      return;
    }

    if (step.key === "birthday") {
      const parts = value.split("/").map(Number);
      const dob = new Date(parts[2], parts[0] - 1, parts[1]);
      const ageMs = Date.now() - dob.getTime();
      const age = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 18) {
        setShowAgeGate(true);
        return;
      }
    }

    advanceWithReaction(value, step.key);
  };

  // Stage 1 of deep_prompt: user picks a prompt chip
  const handlePromptPickSelect = (question: string) => {
    addUserMessage(question);
    setDeepPromptQuestion(question);
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setExpression("warm");
      setIsTalking(true);
      setMessages(prev => [
        ...prev,
        { id: `sunny-react-${Date.now()}`, from: "sunny", text: "okay. finish it however you want." },
      ]);
      setTimeout(() => setIsTalking(false), 1200);
    }, 600);
  };

  // Stage 2 of deep_prompt: user submits their answer
  const handlePromptSubmit = async (value: string, mode: ResponseMode) => {
    const displayText = mode === "voice" ? "voice memo" : mode === "video" ? "video recorded" : value;
    addUserMessage(displayText);
    const promptData = deepPromptQuestion
      ? { prompt_question: deepPromptQuestion, prompt_answer: value }
      : value;
    const data = { ...profileData, [step.key]: promptData };
    // Save media URL to deep_prompt_media keyed by the prompt question
    if ((mode === "voice" || mode === "video") && deepPromptQuestion && user) {
      try {
        const { data: existing } = await supabase
          .from("profiles")
          .select("deep_prompt_media")
          .eq("user_id", user.id)
          .single();
        const current = (existing?.deep_prompt_media as Record<string, any>) || {};
        await supabase
          .from("profiles")
          .update({ deep_prompt_media: { ...current, [deepPromptQuestion]: { uri: value, type: mode } } } as any)
          .eq("user_id", user.id);
      } catch { /* non-blocking */ }
    }
    setProfileData(data);
    advanceWithReaction(mode === "voice" || mode === "video" ? displayText : value, step.key);
  };

  const handleMultiDone = () => {
    if (selectedChips.length === 0) return;
    addUserMessage(selectedChips.join(", "));
    const data = { ...profileData, [step.key]: selectedChips };
    setProfileData(data);
    advanceWithReaction(selectedChips.join(", "), step.key);
  };

  const handlePhotoUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "photo access needed",
        "please go to Settings > Tandem and allow photo library access.",
        [
          { text: "cancel", style: "cancel" },
          { text: "open settings", onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as any,
      allowsEditing: true,
      aspect: [1, 1] as [number, number],
      quality: 0.5,       // lower quality forces a compressed local copy, avoids iCloud full-res download
      exif: false,        // skip metadata download — major cause of "Downloading from iCloud" stall
      base64: false,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const uri = result.assets[0].uri;
    setProfilePhotoUri(uri);
    setPhotoUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const ext = (uri.split(".").pop() || "jpg").toLowerCase().replace("jpeg", "jpg");
      const path = `${user?.id}/profile.${ext}`;
      const { error } = await supabase.storage.from("profile-photos").upload(path, blob, { contentType: `image/${ext}`, upsert: true });
      if (!error) {
        const { data: urlData } = supabase.storage.from("profile-photos").getPublicUrl(path);
        console.log("Profile photo saved:", urlData.publicUrl);
        const data = { ...profileData, photos: [urlData.publicUrl] };
        setProfileData(data);
      }
    } catch (e) {
      console.warn("Photo upload failed:", e);
    } finally {
      setPhotoUploading(false);
    }
    addUserMessage("photo added ✓");
    advanceWithReaction("photo added", "photo", true);
  };

  const handleSkip = () => {
    const data = { ...profileData, [step.key]: null };
    setProfileData(data);
    if (step.key === "deep_prompt") setDeepPromptQuestion(null);
    goNextStep();
  };

  const toggleChip = (value: string) => {
    if (step.inputType === "single") {
      handleSingleSelect(value);
    } else {
      setSelectedChips(prev =>
        prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
      );
    }
  };

  const shouldShowAvatar = (index: number): boolean => {
    if (messages[index].from !== "sunny") return false;
    if (index === 0) return true;
    return messages[index - 1].from !== "sunny";
  };

  const isLastSunnyMsg = (index: number): boolean => {
    if (messages[index].from !== "sunny") return false;
    for (let i = index + 1; i < messages.length; i++) {
      if (messages[i].from === "sunny") return false;
    }
    return true;
  };

  if (showWalkthrough === null) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  if (showWalkthrough) {
    const slide = WALKTHROUGH_SLIDES[walkthroughSlide];
    return (
      <TouchableOpacity
        style={{ flex: 1 }}
        activeOpacity={1}
        onPress={advanceWalkthrough}
      >
        <LinearGradient
          colors={['#2DD4BF', '#3B82F6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}
        >
          <Animated.View style={{ opacity: walkthroughFade, alignItems: 'center', gap: 20 }}>
            <SunnyAvatar expression="warm" size={80} />
            <Text style={{
              fontSize: walkthroughSlide === 0 ? 48 : 32,
              fontWeight: '800',
              color: '#FFFFFF',
              textAlign: 'center',
              letterSpacing: -1.5,
              lineHeight: walkthroughSlide === 0 ? 54 : 40,
            }}>
              {slide.headline}
            </Text>
            <Text style={{
              fontSize: 14,
              color: 'rgba(255,255,255,0.7)',
              textAlign: 'center',
              marginTop: 8,
            }}>
              tap to continue
            </Text>
          </Animated.View>

          {/* Dot indicators */}
          <View style={{
            position: 'absolute',
            bottom: 60,
            flexDirection: 'row',
            gap: 8,
          }}>
            {WALKTHROUGH_SLIDES.map((_, i) => (
              <View
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i === walkthroughSlide
                    ? '#FFFFFF'
                    : 'rgba(255,255,255,0.4)',
                }}
              />
            ))}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (showSplash === null) return null; // waiting for AsyncStorage check
  if (showSplash) {
    return <SplashAnimationScreen onComplete={() => setShowSplash(false)} />;
  }

  if (showAgeGate) {
    return (
      <View style={styles.ageGate}>
        <SunnyAvatar expression="warm" size={72} />
        <Text style={styles.ageGateTitle}>hey, we love the enthusiasm.</Text>
        <Text style={styles.ageGateBody}>
          tandem is for adults 18 and up. come back when you're ready — we'll be here.
        </Text>
        <TouchableOpacity
          style={styles.ageGateBtn}
          activeOpacity={0.85}
          onPress={() => signOut()}
        >
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ageGateBtnInner}
          >
            <Text style={styles.ageGateBtnText}>got it</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Progress bar */}
      <View style={[styles.progressContainer, { paddingTop: insets.top + 8 }]}>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          >
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
        <Text style={styles.progressLabel}>
          {PROGRESS_MAP[stepIndex] >= 90
            ? "almost done"
            : PROGRESS_MAP[stepIndex] >= 60
            ? "almost there"
            : "just getting started"}
        </Text>
      </View>

      {/* Chat area */}
      <ScrollView
        ref={scrollRef}
        style={styles.chat}
        contentContainerStyle={[styles.chatContent, { paddingBottom: 16 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length > 0 && (
          <Text style={styles.sunnyLabel}>SUNNY</Text>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            showAvatar={shouldShowAvatar(i)}
            expression={expression}
            isTalking={isTalking && isLastSunnyMsg(i)}
          />
        ))}

        {isTyping && <TypingIndicator />}
      </ScrollView>

      {/* Input area */}
      <View style={[styles.inputArea, { paddingBottom: insets.bottom + 8 }]}>
        {isShowingInput && !isTyping && (
          <>
            {(step.inputType === "single" || step.inputType === "multi") && step.options && (
              <OptionChips
                options={step.options}
                multiSelect={step.inputType === "multi"}
                selected={selectedChips}
                onSelect={toggleChip}
                onDone={step.inputType === "multi" ? handleMultiDone : undefined}
                gridMode={step.key === "personality"}
              />
            )}
            {step.inputType === "text" && (
              <ChatTextInput
                placeholder={step.placeholder}
                onSubmit={handleTextSubmit}
              />
            )}
            {step.inputType === "birthday" && (
              <BirthdayInput onSubmit={handleTextSubmit} />
            )}
            {step.inputType === "photo" && (
              <View style={styles.photoPickerArea}>
                {profilePhotoUri ? (
                  <View style={styles.photoPreviewRow}>
                    <Image source={{ uri: profilePhotoUri }} style={styles.photoPreview} />
                    <TouchableOpacity onPress={handlePhotoUpload} style={styles.photoChangeBtn} activeOpacity={0.7}>
                      <Text style={styles.photoChangeBtnText}>{photoUploading ? "uploading..." : "change photo"}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={handlePhotoUpload} style={styles.photoPickerBtn} activeOpacity={0.8}>
                    <Ionicons name="camera-outline" size={22} color={colors.teal} />
                    <Text style={styles.photoPickerText}>choose a photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {step.inputType === "prompt_pick" && (
              deepPromptQuestion === null ? (
                <OptionChips
                  options={step.options!}
                  multiSelect={false}
                  selected={[]}
                  onSelect={handlePromptPickSelect}
                />
              ) : (
                <PromptInput
                  placeholder={deepPromptQuestion}
                  onSubmit={handlePromptSubmit}
                  userId={user?.id}
                />
              )
            )}

            {/* Skip link — shown on all skippable steps */}
            {!UNSKIPPABLE.has(step.key) && (
              <TouchableOpacity onPress={handleSkip} style={styles.skipBtn} activeOpacity={0.7}>
                <Text style={styles.skipText}>skip this question</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* Notification permission prompt overlay */}
      {showNotifPrompt && (
        <View style={styles.notifOverlay}>
          <SunnyAvatar expression="warm" size={64} />
          <Text style={styles.notifTitle}>one last thing.</Text>
          <Text style={styles.notifBody}>
            sunny needs to be able to reach you. enable notifications so you know when someone wants to tandem.
          </Text>
          <TouchableOpacity
            style={styles.notifYesBtn}
            activeOpacity={0.85}
            onPress={async () => {
              setShowNotifPrompt(false);
              await registerForPushNotifications();
              onComplete(pendingCompleteData ?? {});
            }}
          >
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.notifYesBtnInner}
            >
              <Text style={styles.notifYesBtnText}>yes please</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setShowNotifPrompt(false);
              onComplete(pendingCompleteData ?? {});
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.notifSkip}>maybe later</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  progressContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 6,
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.muted,
    letterSpacing: 0.5,
  },

  // Age gate
  ageGate: {
    flex: 1, backgroundColor: colors.background,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 36, gap: 16,
  },
  ageGateTitle: {
    fontSize: 22, fontFamily: "Quicksand-Bold",
    color: colors.foreground, textAlign: "center",
  },
  ageGateBody: {
    fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 22,
  },
  ageGateBtn: {
    width: "100%", height: 52, borderRadius: 26, overflow: "hidden", marginTop: 8,
  },
  ageGateBtnInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  ageGateBtnText: { fontSize: 15, fontWeight: "700", color: colors.white },

  // Notification prompt overlay
  notifOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.background,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 36, gap: 16,
  },
  notifTitle: {
    fontSize: 22, fontFamily: "Quicksand-Bold",
    color: colors.foreground, textAlign: "center",
  },
  notifBody: {
    fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 22,
  },
  notifYesBtn: {
    width: "100%", height: 52, borderRadius: 26, overflow: "hidden", marginTop: 8,
  },
  notifYesBtnInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  notifYesBtnText: { fontSize: 15, fontWeight: "700", color: colors.white },
  notifSkip: { fontSize: 13, color: colors.muted, marginTop: 4 },

  chat: { flex: 1 },
  chatContent: { paddingHorizontal: 16, paddingTop: 16 },

  sunnyLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.teal,
    letterSpacing: 1,
    marginLeft: 40,
    marginBottom: 4,
  },

  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 6,
    gap: 8,
  },
  bubbleRowUser: { flexDirection: "row-reverse" },
  avatarSlot: { width: 32, height: 32, flexShrink: 0 },
  sunnyBubble: {
    maxWidth: "78%",
    backgroundColor: colors.white,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderLeftWidth: 2,
    borderLeftColor: "rgba(45,212,191,0.3)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sunnyBubbleText: { fontSize: 15, color: "#2C2416", lineHeight: 22 },
  userBubble: {
    maxWidth: "78%",
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...shadows.brand,
  },
  userBubbleText: { fontSize: 15, color: colors.white, lineHeight: 22 },

  typingRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 6,
    gap: 8,
    paddingLeft: 40,
  },
  typingBubble: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    alignItems: "center",
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "rgba(100,110,130,0.4)",
  },

  inputArea: {
    backgroundColor: "rgba(249,246,242,0.97)",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    maxHeight: 280,
  },

  // Chips
  chipsContainer: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4, gap: 8 },
  chipsScrollArea: { maxHeight: 150 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  optionChip: {
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: "rgba(30,158,137,0.3)",
    backgroundColor: colors.white,
    overflow: "hidden",
  },
  optionChipSelected: { borderColor: "transparent" },
  optionChipGradient: { paddingHorizontal: 12, paddingVertical: 8 },
  optionChipText: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: "600",
    color: colors.teal,
  },
  optionChipTextSelected: { fontSize: 13, fontWeight: "600", color: colors.white },

  doneBtn: {
    borderRadius: radius.full,
    overflow: "hidden",
    marginTop: 6,
    ...shadows.brand,
  },
  doneBtnDisabled: { shadowColor: "transparent", elevation: 0 },
  doneBtnInner: {
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
  },
  doneBtnText: { fontSize: 14, fontWeight: "600", color: colors.white },
  doneBtnTextDisabled: { color: colors.muted },

  // Text inputs
  textInputContainer: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4, gap: 8 },
  textInputRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  textInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 96,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.foreground,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, overflow: "hidden" },
  sendBtnInner: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Mode selector (text / voice / video)
  modeSelector: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
  },
  modeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  modeBtnActive: {
    borderColor: "rgba(30,158,137,0.5)",
    backgroundColor: "rgba(30,158,137,0.07)",
  },
  modeBtnText: { fontSize: 12, fontWeight: "600", color: colors.muted },
  modeBtnTextActive: { color: colors.teal },

  // Media record buttons
  mediaBtn: {
    borderRadius: radius.full,
    overflow: "hidden",
    ...shadows.brand,
  },
  mediaBtnInner: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: radius.full,
  },
  mediaBtnText: { fontSize: 14, fontWeight: "600", color: colors.white },

  // Recording active state
  recordingActive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: "rgba(239,68,68,0.3)",
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EF4444",
  },
  recordingTimer: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#EF4444",
  },
  stopRecordingBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: "#EF4444",
  },
  stopRecordingText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.white,
  },

  // Photo picker
  photoPickerArea: { paddingHorizontal: 16, paddingVertical: 8 },
  photoPickerBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    borderWidth: 1.5, borderColor: colors.teal, borderStyle: "dashed", borderRadius: 12,
    paddingVertical: 20, backgroundColor: colors.background,
  },
  photoPickerText: { fontSize: 15, fontWeight: "600", color: colors.teal },
  photoPreviewRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  photoPreview: { width: 64, height: 64, borderRadius: 32 },
  photoChangeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  photoChangeBtnText: { fontSize: 13, color: colors.muted, fontWeight: "500" },

  // Skip
  skipBtn: {
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 13,
    color: colors.muted,
  },
});
