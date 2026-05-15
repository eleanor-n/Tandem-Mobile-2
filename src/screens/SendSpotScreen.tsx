// SendSpot — flow for sharing your tandem spot with an outside friend.
// Lives outside the tab system; opened from inside ChatScreen.

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Share,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import { colors, radius, gradients, shadows } from "../theme";
import { supabase } from "../lib/supabase";

interface Props {
  tandemId: string;
  partnerName: string;
  onBack: () => void;
  onShared: (shareId: string) => void;
}

type ShareMethod = "text" | "imessage" | "copy" | "other";

export const SendSpotScreen = ({ tandemId, partnerName, onBack, onShared }: Props) => {
  const insets = useSafeAreaInsets();
  const [recipientName, setRecipientName] = useState("");
  const [method, setMethod] = useState<ShareMethod>("text");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocating(false);
        return;
      }
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch (err) {
        console.warn("[SendSpot] location err:", err);
      } finally {
        setLocating(false);
      }
    })();
  }, []);

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-spot-share", {
        body: {
          tandem_id: tandemId,
          recipient_name: recipientName.trim() || null,
        },
      });
      if (error) {
        Alert.alert("something went wrong.", "try again?");
        setSending(false);
        return;
      }
      const payload = data as { share_id: string; public_url: string };

      // Push initial location if we have it
      if (coords) {
        await supabase.functions.invoke("update-spot-location", {
          body: {
            share_id: payload.share_id,
            lat: coords.latitude,
            lng: coords.longitude,
          },
        });
      }

      const message = `here's where i am right now with ${partnerName}. live map auto-ends in 6 hours. ${payload.public_url}`;

      // Hand off to the native share sheet for SMS / iMessage / etc.
      if (method === "copy") {
        // Fall back to share sheet with text — RN's Clipboard API would also work.
        await Share.share({ message });
      } else {
        await Share.share({ message });
      }

      onShared(payload.share_id);
    } catch (err: any) {
      console.warn("[SendSpot] send failed:", err);
      Alert.alert("something went wrong.", err?.message ?? "try again?");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.teal} />
        </TouchableOpacity>
        <Text style={s.title}>send your spot</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 + insets.bottom, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.sunnyLine}>
          we'll send a friend a live link they can check on. it auto-ends in 6 hours.
        </Text>

        {/* Map preview */}
        <View style={s.mapWrap}>
          {locating ? (
            <View style={s.mapPlaceholder}>
              <ActivityIndicator color={colors.teal} />
              <Text style={s.mapPlaceholderText}>finding you...</Text>
            </View>
          ) : coords ? (
            <MapView
              provider={PROVIDER_DEFAULT}
              style={s.map}
              initialRegion={{
                latitude: coords.latitude,
                longitude: coords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
            >
              <Marker coordinate={coords} pinColor={colors.teal} />
            </MapView>
          ) : (
            <View style={s.mapPlaceholder}>
              <Text style={s.mapPlaceholderText}>
                we couldn't get your location. you can still send the link.
              </Text>
            </View>
          )}
        </View>

        {/* Recipient name */}
        <Text style={s.fieldLabel}>their name (optional)</Text>
        <TextInput
          value={recipientName}
          onChangeText={setRecipientName}
          placeholder="who are you sending this to?"
          placeholderTextColor={colors.muted}
          style={s.input}
          maxLength={48}
        />

        {/* Method */}
        <Text style={s.fieldLabel}>send via</Text>
        <View style={s.methodGroup}>
          {(
            [
              { key: "text", label: "text message" },
              { key: "imessage", label: "imessage" },
              { key: "copy", label: "copy link" },
              { key: "other", label: "other" },
            ] as { key: ShareMethod; label: string }[]
          ).map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[s.methodPill, method === opt.key && s.methodPillActive]}
              onPress={() => setMethod(opt.key)}
              activeOpacity={0.85}
            >
              <View
                style={[s.radio, method === opt.key && s.radioActive]}
              />
              <Text
                style={[s.methodText, method === opt.key && s.methodTextActive]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.disclaimer}>
          your friend will see {partnerName}'s first name, your shared activity, and
          a live map. they won't see anyone's phone, email, or last name.
        </Text>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 14) + 10 }]}>
        <TouchableOpacity
          onPress={handleSend}
          disabled={sending || locating}
          activeOpacity={0.88}
          style={s.sendBtnWrap}
        >
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.sendBtn}
          >
            {sending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={s.sendBtnText}>send</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, justifyContent: "center" },
  title: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Quicksand_700Bold",
    color: colors.foreground,
  },

  sunnyLine: {
    fontSize: 18,
    color: "#1F2937",
    fontFamily: "Fraunces_500Medium_Italic",
    fontStyle: "italic",
    marginTop: 20,
    marginBottom: 18,
    lineHeight: 26,
  },

  mapWrap: {
    height: 200,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surface,
    marginBottom: 24,
  },
  map: { width: "100%", height: "100%" },
  mapPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
  },
  mapPlaceholderText: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    fontFamily: "Quicksand_500Medium",
  },

  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Quicksand_700Bold",
    color: colors.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.foreground,
    fontFamily: "Quicksand_500Medium",
    marginBottom: 20,
  },

  methodGroup: { gap: 8, marginBottom: 22 },
  methodPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  methodPillActive: {
    borderColor: colors.teal,
    backgroundColor: colors.tintTeal,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
  },
  radioActive: {
    borderColor: colors.teal,
    backgroundColor: colors.teal,
  },
  methodText: {
    fontSize: 14,
    color: colors.secondary,
    fontFamily: "Quicksand_500Medium",
  },
  methodTextActive: {
    color: colors.foreground,
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
  },

  disclaimer: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
    fontFamily: "Quicksand_500Medium",
  },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  sendBtnWrap: { borderRadius: radius.full, overflow: "hidden", ...shadows.brand },
  sendBtn: {
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnText: {
    fontSize: 16,
    color: colors.white,
    fontFamily: "Quicksand_700Bold",
    fontWeight: "700",
  },
});
