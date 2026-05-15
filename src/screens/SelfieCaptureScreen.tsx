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
  const [verifying, setVerifying] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string>("");
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

  const handleRetake = () => {
    setPhotoUri(null);
    setUploadError(null);
  };

  const handleUseThis = async () => {
    if (!photoUri || !user) return;
    setUploading(true);
    setUploadError(null);
    try {
      // FormData pattern — works reliably on iOS/Hermes. atob/Blob conversions
      // through fetch(uri).blob() can fail silently on RN.
      // Path uses folder structure so storage RLS can check
      //   (storage.foldername(name))[1] = auth.uid()::text
      // — same pattern as the videos bucket.
      const fileName = `selfie_${Date.now()}.jpg`;
      const path = `${user.id}/${fileName}`;
      const formData = new FormData();
      formData.append("file", { uri: photoUri, name: fileName, type: "image/jpeg" } as any);

      const { error: uploadErr } = await supabase
        .storage
        .from("selfies")
        .upload(path, formData, { contentType: "image/jpeg", upsert: true });
      if (uploadErr) throw uploadErr;

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          selfie_url: path,
          selfie_uploaded_at: new Date().toISOString(),
          selfie_verification_status: null,
          selfie_similarity_score: null,
          selfie_reviewed_at: null,
        } as any)
        .eq("user_id", user.id);
      if (updateErr) throw updateErr;

      // Upload succeeded — now run automated face comparison.
      setUploading(false);
      setVerifying(true);
      const { data: result, error: invokeErr } = await supabase.functions.invoke(
        "verify-selfie-rekognition",
        { body: {} },
      );
      setVerifying(false);

      const status = (result as any)?.status as "approved" | "pending_review" | "rejected" | undefined;
      const message = (result as any)?.message as string | undefined;

      if (invokeErr || !status) {
        console.warn("[SelfieCapture] verify invoke failed:", invokeErr?.message ?? result);
        // Treat as pending — user can move on.
        setDoneMessage("we're double-checking. you can use Tandem in the meantime.");
        setShowSunnyDone(true);
        Animated.timing(sunnyOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        setTimeout(() => onComplete(), 2200);
        return;
      }

      if (status === "rejected") {
        setUploadError(
          message
            ?? "your selfie didn't match your profile photo. take another with your face clearly visible.",
        );
        // Keep the photo visible so the user sees what was rejected alongside
        // the error message. handleRetake clears photoUri + error together.
        return;
      }

      // approved or pending_review — both advance.
      setDoneMessage(
        status === "approved"
          ? (message ?? "you're verified.")
          : "we're double-checking. you can use Tandem in the meantime.",
      );
      setShowSunnyDone(true);
      Animated.timing(sunnyOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      setTimeout(() => onComplete(), status === "approved" ? 1600 : 2200);
    } catch (err: any) {
      // Detailed log so we can see the actual Supabase error code/message in
      // device logs (Xcode Console / `npx react-native log-ios`).
      try {
        console.log("[selfie upload]", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
      } catch {
        console.log("[selfie upload] raw error:", err);
      }
      console.warn("[SelfieCapture] upload failed:", err?.message ?? err);
      setUploadError("We couldn't save your selfie. Try again.");
      setUploading(false);
      setVerifying(false);
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
          {doneMessage}
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
        {uploading || verifying ? (
          <View style={s.uploadingRow}>
            <ActivityIndicator color={colors.teal} />
            <Text style={s.uploadingText}>{verifying ? "Verifying..." : "Uploading..."}</Text>
          </View>
        ) : (
          <>
            {uploadError ? (
              <Text style={s.errorText}>{uploadError}</Text>
            ) : null}
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
          </>
        )}
      </View>
    );
  }

  return (
    <View style={s.root}>
      <View style={[s.cameraHeader, { paddingTop: insets.top + 8 }]}>
        <Text style={s.title}>Verify with a selfie</Text>
        <Text style={s.sub}>so we know it's really you. front-facing, eyes on camera.</Text>
        <Text style={s.sunnyHint}>we'll match this against your profile photo.</Text>
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
  sunnyHint: {
    fontSize: 15,
    color: colors.foreground,
    fontFamily: "Fraunces_500Medium_Italic",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 10,
    paddingHorizontal: 16,
    lineHeight: 20,
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
  uploadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 24,
  },
  uploadingText: {
    fontSize: 15,
    color: colors.secondary,
    fontFamily: "Quicksand_600SemiBold",
  },
  errorText: {
    fontSize: 14,
    color: "#DC2626",
    fontFamily: "Quicksand_500Medium",
    textAlign: "center",
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 24,
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
    fontFamily: "Fraunces_500Medium_Italic",
    fontSize: 22,
    fontStyle: "italic",
    color: colors.foreground,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 28,
  },
  sunnyDoneLine: {
    fontFamily: "Fraunces_500Medium_Italic",
    fontSize: 22,
    fontStyle: "italic",
    color: colors.foreground,
    textAlign: "center",
    marginHorizontal: 32,
    marginTop: 200,
    lineHeight: 30,
  },
});
