import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, shadows, gradients } from "../theme";

interface ChatScreenProps {
  convo: { id: string; name: string; photo: string };
  onBack: () => void;
}

// Mock messages so the thread doesn't feel empty
const MOCK_MESSAGES = [
  { id: "m1", text: "hey! stoked you're in for the hike 🥾", sent: false },
  { id: "m2", text: "same! what time were you thinking?", sent: true },
  { id: "m3", text: "7am at the trailhead — there's parking on ridge rd", sent: false },
];

export const ChatScreen = ({ convo, onBack }: ChatScreenProps) => {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(MOCK_MESSAGES);

  const sendMessage = () => {
    if (!message.trim()) return;
    setMessages(prev => [...prev, { id: Date.now().toString(), text: message.trim(), sent: true }]);
    setMessage("");
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.teal} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <View style={s.headerAvatarRing}>
            <Image source={{ uri: convo.photo }} style={s.headerAvatar} />
          </View>
          <Text style={s.headerName}>{convo.name}</Text>
        </View>
        {/* Activity context pill */}
        <TouchableOpacity style={s.contextPill} activeOpacity={0.8}>
          <Ionicons name="location" size={11} color={colors.teal} />
          <Text style={s.contextText}>activity</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        style={s.messages}
        contentContainerStyle={[s.messagesContent, { paddingBottom: 20 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Matched header */}
        <View style={s.matchedBanner}>
          <View style={s.matchedAvatarWrap}>
            <Image source={{ uri: convo.photo }} style={s.matchedAvatar} />
            <View style={s.matchedBadge}>
              <Ionicons name="checkmark" size={10} color={colors.white} />
            </View>
          </View>
          <Text style={s.matchedName}>{convo.name}</Text>
          <Text style={s.matchedHint}>you matched! say something good.</Text>
        </View>

        {/* Message bubbles */}
        {messages.map(m => (
          <View key={m.id} style={[s.bubbleRow, m.sent && s.bubbleRowSent]}>
            {m.sent ? (
              <LinearGradient
                colors={gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[s.bubble, s.bubbleSent]}
              >
                <Text style={s.bubbleTextSent}>{m.text}</Text>
              </LinearGradient>
            ) : (
              <View style={[s.bubble, s.bubbleReceived]}>
                <Text style={s.bubbleTextReceived}>{m.text}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Input bar */}
      <View style={[s.inputBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TextInput
          style={s.input}
          placeholder={`message ${convo.name}...`}
          placeholderTextColor={colors.muted}
          value={message}
          onChangeText={setMessage}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
          multiline
        />
        <TouchableOpacity
          style={[s.sendBtn, !message.trim() && s.sendBtnDisabled]}
          activeOpacity={message.trim() ? 0.88 : 1}
          onPress={sendMessage}
          disabled={!message.trim()}
        >
          <LinearGradient
            colors={message.trim() ? gradients.brand : ["#E5E7EB", "#E5E7EB"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.sendBtnInner}
          >
            <Ionicons
              name="arrow-up"
              size={18}
              color={message.trim() ? colors.white : colors.muted}
            />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, alignItems: "flex-start", justifyContent: "center" },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerAvatarRing: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2, borderColor: colors.teal, overflow: "hidden",
  },
  headerAvatar: { width: "100%", height: "100%", borderRadius: 16 },
  headerName: { fontSize: 16, fontWeight: "700", color: colors.foreground },
  contextPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.tintTeal, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  contextText: { fontSize: 11, fontWeight: "700", color: colors.teal },

  // Messages
  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 16, paddingTop: 20, gap: 10 },
  matchedBanner: { alignItems: "center", gap: 8, marginBottom: 24 },
  matchedAvatarWrap: { position: "relative" },
  matchedAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface },
  matchedBadge: {
    position: "absolute", bottom: 0, right: 0,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.teal, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.white,
  },
  matchedName: { fontSize: 17, fontWeight: "700", color: colors.foreground },
  matchedHint: { fontSize: 13, color: colors.muted },

  // Bubbles
  bubbleRow: { flexDirection: "row", alignItems: "flex-end" },
  bubbleRowSent: { justifyContent: "flex-end" },
  bubble: { maxWidth: "75%", paddingHorizontal: 14, paddingVertical: 10 },
  bubbleSent: {
    borderRadius: 18, borderBottomRightRadius: 4,
  },
  bubbleReceived: {
    borderRadius: 18, borderBottomLeftRadius: 4,
    backgroundColor: colors.white,
    borderWidth: 1.5, borderColor: colors.border,
  },
  bubbleTextSent: { fontSize: 15, color: colors.white, lineHeight: 21 },
  bubbleTextReceived: { fontSize: 15, color: colors.foreground, lineHeight: 21 },

  // Input
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    paddingHorizontal: 16, paddingTop: 10,
    backgroundColor: colors.white,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  input: {
    flex: 1, backgroundColor: colors.background, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: 16, paddingVertical: 11,
    fontSize: 15, color: colors.foreground, maxHeight: 120,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, overflow: "hidden", ...shadows.brand },
  sendBtnDisabled: { shadowOpacity: 0 },
  sendBtnInner: { flex: 1, alignItems: "center", justifyContent: "center" },
});
