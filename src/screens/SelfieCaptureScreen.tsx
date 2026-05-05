import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Animated,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { colors, radius, gradients, shadows } from "../theme";

interface SelfieCaptureScreenProps {
  onComplete: () => void;
  onSkip?: () => void;
  isStandalone?: boolean;
}

export const SelfieCaptureScreen = ({ onComplete, onSkip, isStandalone }: SelfieCaptureScreenProps) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showSunnyDone, setShowSunnyDone] = useState(false);
  const sunnyOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const handleSnap = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
      });
      if (photo?.uri) setPhotoUri(photo.uri);
    } catch {
      // ignore — user can retry
    }
  };

  const handleRetake = () => setPhotoUri(null);

  const handleUseThis = async () => {
    if (!photoUri || !user) return;
    setUploading(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const path = `${user.id}.jpg`;

      const { error: uploadErr } = await supabase
        .storage
        .from("selfies")
        .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
      if (uploadErr) throw uploadErr;

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          selfie_url: path,
          selfie_uploaded_at: new Date().toISOString(),
        } as any)
        .eq("user_id", user.id);
      if (updateErr) throw updateErr;

      setShowSunnyDone(true);
      Animated.timing(sunnyOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      setTimeout(() => onComplete(), 2000);
    } catch (err) {
      setUploading(false);
    }
  };

  const handleDeniedFallback = () => {
    if (onSkip) onSkip();
    else onComplete();
  };

  if (showSunnyDone) {
    return (
      <View style={s.root}>
        <Animated.Text style={[s.sunnyDoneLine, { opacity: sunnyOpacity }]}>
          great. we're checking it out, this usually takes a few hours.
        </Animated.Text>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={s.root}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[s.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <View style={s.deniedWrap}>
          <Ionicons name="camera-outline" size={36} color={colors.muted} />
          <Text style={s.sunnyDeniedLine}>
            no camera access? you can verify later from your profile. for now, no big deal.
          </Text>
          <TouchableOpacity onPress={handleDeniedFallback} activeOpacity={0.88} style={{ marginTop: 24, width: "100%" }}>
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cta}>
              <Text style={s.ctaText}>continue</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (photoUri) {
    return (
      <View style={[s.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Text style={s.title}>look good?</Text>
        <Image source={{ uri: photoUri }} style={s.preview} />
        {uploading ? (
          <View style={{ alignItems: "center", marginTop: 24 }}>
            <ActivityIndicator color={colors.teal} />
          </View>
        ) : (
          <View style={s.previewBtnRow}>
            <TouchableOpacity onPress={handleRetake} activeOpacity={0.85} style={s.outlineBtn}>
              <Text style={s.outlineBtnText}>retake</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleUseThis} activeOpacity={0.88} style={{ flex: 1 }}>
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cta}>
                <Text style={s.ctaText}>use this</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={s.root}>
      <View style={[s.cameraHeader, { paddingTop: insets.top + 8 }]}>
        <Text style={s.title}>take a verification selfie</Text>
        <Text style={s.sub}>so we know it's really you. front-facing, eyes on camera.</Text>
      </View>
      <View style={s.cameraWrap}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
      </View>
      <View style={[s.shutterRow, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity onPress={handleSnap} activeOpacity={0.85} style={s.shutter}>
          <View style={s.shutterInner} />
        </TouchableOpacity>
        {isStandalone && onSkip ? (
          <TouchableOpacity onPress={onSkip} activeOpacity={0.7} style={s.cancelBtn}>
            <Text style={s.cancelText}>cancel</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cameraHeader: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontFamily: "Quicksand_700Bold",
    color: colors.foreground,
    textAlign: "center",
    paddingHorizontal: 24,
    marginTop: 16,
  },
  sub: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    marginTop: 6,
    fontFamily: "Quicksand_400Regular",
  },
  cameraWrap: {
    flex: 1,
    margin: 24,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  shutterRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: colors.foreground,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.foreground,
  },
  cancelBtn: {
    marginTop: 14,
  },
  cancelText: {
    color: colors.muted,
    fontSize: 14,
    fontFamily: "Quicksand_500Medium",
  },
  preview: {
    flex: 1,
    margin: 24,
    borderRadius: radius.xl,
    backgroundColor: "#000",
  },
  previewBtnRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  outlineBtn: {
    flex: 1,
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  outlineBtnText: {
    fontSize: 15,
    color: colors.secondary,
    fontFamily: "Quicksand_600SemiBold",
  },
  cta: {
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaText: {
    fontSize: 15,
    color: colors.white,
    fontFamily: "Quicksand_700Bold",
  },
  deniedWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  sunnyDeniedLine: {
    fontFamily: "Caveat_700Bold",
    fontSize: 22,
    fontStyle: "italic",
    color: colors.foreground,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 28,
  },
  sunnyDoneLine: {
    fontFamily: "Caveat_700Bold",
    fontSize: 22,
    fontStyle: "italic",
    color: colors.foreground,
    textAlign: "center",
    marginHorizontal: 32,
    marginTop: 200,
    lineHeight: 30,
  },
});
