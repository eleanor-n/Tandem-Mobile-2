import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, KeyboardAvoidingView,
  Platform, ScrollView, Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as Application from "expo-application";
import { TandemLogo } from "../components/TandemLogo";
import { GradientButton } from "../components/GradientButton";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { colors, radius, shadows } from "../theme";

WebBrowser.maybeCompleteAuthSession();

interface AuthScreenProps {
  onBack: () => void;
}

export const AuthScreen = ({ onBack }: AuthScreenProps) => {
  const insets = useSafeAreaInsets();
  // Default to signup — users only see this screen once (new users)
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  // Phone auth state
  const [phoneStep, setPhoneStep] = useState<"idle" | "phone" | "otp">("idle");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);

  React.useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing info", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            // Skip email confirmation — auth context will pick up session automatically
            emailRedirectTo: undefined,
          },
        });
        if (error) throw error;
        // No email verification popup — session is created immediately
        // AuthContext onAuthStateChange will detect the new session and navigate forward
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // SUPABASE SETUP REQUIRED:
  // Dashboard → Authentication → URL Configuration → Redirect URLs
  // Must include BOTH: tandem://  AND  tandem://auth/callback
  //
  // GOOGLE CLOUD CONSOLE SETUP REQUIRED:
  // Go to console.cloud.google.com → APIs & Services → Credentials
  // Click on your OAuth 2.0 Client ID (Web application type)
  // Under "Authorized redirect URIs" add EXACTLY:
  //   https://ccntlaunczirvntnsjbm.supabase.co/auth/v1/callback
  // Without this, Google blocks the redirect to Supabase and OAuth fails.
  // This is a one-time manual step — no code change needed.
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const redirectUrl = "tandem://auth/callback";
      console.log("[OAuth] starting Google sign-in, redirectUrl:", redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) { console.error("[OAuth] signInWithOAuth error:", error.message); throw error; }
      if (!data?.url) throw new Error("No auth URL returned from Supabase");
      console.log("[OAuth] opening browser with url:", data.url.substring(0, 80) + "...");

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl,
        { preferEphemeralSession: true }
      );

      console.log("[OAuth] browser result type:", result.type);
      if (result.type === "cancel") return;

      if (result.type === "success" && result.url) {
        const url = result.url;
        console.log("[OAuth] callback url:", url);

        // Try PKCE code exchange first
        const qIndex = url.indexOf("?");
        if (qIndex !== -1) {
          const params = new URLSearchParams(url.substring(qIndex + 1));
          const code = params.get("code");
          const at = params.get("access_token");
          const rt = params.get("refresh_token");
          if (code) {
            console.log("[OAuth] exchanging PKCE code");
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(url);
            if (exchangeError) throw exchangeError;
            return;
          }
          if (at && rt) {
            console.log("[OAuth] setting session from query tokens");
            const { error: sessionError } = await supabase.auth.setSession({ access_token: at, refresh_token: rt });
            if (sessionError) throw sessionError;
            return;
          }
        }

        // Try hash fragment
        const hashIndex = url.indexOf("#");
        if (hashIndex !== -1) {
          const params = new URLSearchParams(url.substring(hashIndex + 1));
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          const code = params.get("code");
          if (accessToken && refreshToken) {
            console.log("[OAuth] setting session from hash tokens");
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) throw sessionError;
            return;
          }
          if (code) {
            console.log("[OAuth] exchanging PKCE code from hash");
            await supabase.auth.exchangeCodeForSession(url);
            return;
          }
        }

        // Fallback: code anywhere in URL
        if (url.includes("code=")) {
          console.log("[OAuth] exchanging code (fallback)");
          await supabase.auth.exchangeCodeForSession(url);
          return;
        }

        throw new Error("Could not extract auth tokens from redirect URL: " + url);
      }
    } catch (err: any) {
      console.error("[OAuth] Google sign-in failed:", err.message);
      Alert.alert("Google sign in failed", err.message || "Something went wrong.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    // Apple Sign In sends the bundle ID as audience in the id_token.
    // In Expo Go the bundle ID is host.exp.Exponent, which Apple rejects.
    // Guard against this so the error is clean instead of cryptic.
    if (Application.applicationId === "host.exp.Exponent") {
      Alert.alert(
        "not available in development",
        "Apple Sign In requires a native build. use email or Google to sign in for now."
      );
      return;
    }
    setAppleLoading(true);
    try {
      const nonce = Math.random().toString(36).substring(2);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce
      );
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) throw new Error("No identity token returned from Apple");
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
        nonce,
      });
      if (error) throw error;
    } catch (err: any) {
      if (err.code === "ERR_REQUEST_CANCELED") return; // user dismissed the sheet
      console.error("[Apple] sign-in failed:", err.message);
      Alert.alert("Apple sign in failed", err.message || "Something went wrong.");
    } finally {
      setAppleLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const trimmed = phone.trim();
    if (!trimmed) {
      Alert.alert("enter your number", "include your country code, e.g. +1 555 000 0000");
      return;
    }
    setPhoneLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: trimmed });
      if (error) throw error;
      setPhoneStep("otp");
    } catch (err: any) {
      Alert.alert("couldn't send code", err.message || "check the number and try again.");
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const trimmed = otp.trim();
    if (trimmed.length !== 6) {
      Alert.alert("enter the 6-digit code", "check your messages and try again.");
      return;
    }
    setPhoneLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: phone.trim(),
        token: trimmed,
        type: "sms",
      });
      if (error) throw error;
      // Auth state listener in App.tsx picks up the session automatically
    } catch (err: any) {
      Alert.alert("incorrect code", err.message || "the code may have expired. tap 'resend' to get a new one.");
    } finally {
      setPhoneLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back — goes to welcome screen, or exits phone step back to main */}
        <TouchableOpacity
          onPress={() => phoneStep !== "idle" ? setPhoneStep("idle") : onBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>back</Text>
        </TouchableOpacity>

        {/* Logo + hero */}
        <View style={styles.heroBlock}>
          <TandemLogo size="lg" showWordmark />
          <Text style={styles.heroText}>
            {phoneStep === "otp"
              ? "check your\ntexts."
              : phoneStep === "phone"
              ? "what's your\nnumber?"
              : mode === "signin" ? "welcome\nback." : "let's get\nyou in."}
          </Text>
          <Text style={styles.subText}>
            {phoneStep === "otp"
              ? `we sent a 6-digit code to ${phone}`
              : phoneStep === "phone"
              ? "we'll text you a sign-in code. no password needed."
              : mode === "signin" ? "find your people. never go alone." : "join tandem. it's free."}
          </Text>
        </View>

        {/* ── PHONE STEP: enter number ─────────────────────── */}
        {phoneStep === "phone" && (
          <>
            <TextInput
              style={styles.input}
              placeholder="+1 555 000 0000"
              placeholderTextColor={colors.muted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              autoFocus
            />
            <GradientButton
              label={phoneLoading ? "..." : "send code"}
              onPress={handleSendOtp}
              disabled={phoneLoading}
              style={styles.submitBtn}
            />
          </>
        )}

        {/* ── PHONE STEP: enter OTP ────────────────────────── */}
        {phoneStep === "otp" && (
          <>
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="000000"
              placeholderTextColor={colors.muted}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <GradientButton
              label={phoneLoading ? "..." : "verify"}
              onPress={handleVerifyOtp}
              disabled={phoneLoading}
              style={styles.submitBtn}
            />
            <TouchableOpacity onPress={() => setPhoneStep("phone")} style={styles.toggleBtn} activeOpacity={0.7}>
              <Text style={styles.toggleText}>
                wrong number or didn't get it?{" "}
                <Text style={styles.toggleTextBold}>resend</Text>
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── MAIN AUTH (idle) ─────────────────────────────── */}
        {phoneStep === "idle" && (
          <>
            {/* Apple button */}
            {appleAvailable && Application.applicationId !== "host.exp.Exponent" && (
              <TouchableOpacity
                onPress={handleAppleSignIn}
                disabled={appleLoading || loading || googleLoading || phoneLoading}
                activeOpacity={0.88}
                style={styles.appleBtn}
              >
                {appleLoading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <AntDesign name="apple" size={18} color={colors.white} />
                    <Text style={styles.appleBtnText}>continue with apple</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Google button */}
            <TouchableOpacity
              onPress={handleGoogleSignIn}
              disabled={googleLoading || loading || appleLoading || phoneLoading}
              activeOpacity={0.88}
              style={styles.googleBtn}
            >
              {googleLoading ? (
                <ActivityIndicator color={colors.foreground} />
              ) : (
                <>
                  <AntDesign name="google" size={18} color="#4285F4" />
                  <Text style={styles.googleBtnText}>continue with google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Phone button */}
            <TouchableOpacity
              onPress={() => setPhoneStep("phone")}
              disabled={loading || googleLoading || appleLoading}
              activeOpacity={0.88}
              style={styles.phoneBtn}
            >
              <Ionicons name="phone-portrait-outline" size={18} color={colors.foreground} />
              <Text style={styles.googleBtnText}>continue with phone</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email + Password */}
            <View style={styles.inputs}>
              <TextInput
                style={styles.input}
                placeholder="email"
                placeholderTextColor={colors.muted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
              <TextInput
                style={styles.input}
                placeholder="password"
                placeholderTextColor={colors.muted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </View>

            {/* Submit */}
            <GradientButton
              label={loading ? "..." : mode === "signin" ? "welcome back" : "let's go"}
              onPress={handleEmailAuth}
              disabled={loading || googleLoading}
              style={styles.submitBtn}
            />

            {/* Toggle mode */}
            <TouchableOpacity
              onPress={() => setMode(m => (m === "signin" ? "signup" : "signin"))}
              style={styles.toggleBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.toggleText}>
                {mode === "signin" ? "new here? " : "been here before? "}
                <Text style={styles.toggleTextBold}>
                  {mode === "signin" ? "join tandem" : "sign in"}
                </Text>
              </Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.legal}>
          By continuing, you agree to Tandem's{" "}
          <Text
            style={styles.legalLink}
            onPress={async () => {
              try {
                await Linking.openURL("https://thetandemweb.com/terms");
              } catch {
                Alert.alert("Coming soon", "Our terms of service will be available at thetandemweb.com");
              }
            }}
          >
            Terms of Service
          </Text>
          {" "}and{" "}
          <Text
            style={styles.legalLink}
            onPress={async () => {
              try {
                await Linking.openURL("https://thetandemweb.com/privacy");
              } catch {
                Alert.alert("Coming soon", "Our privacy policy will be available at thetandemweb.com");
              }
            }}
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: 24, gap: 16 },

  backBtn: { paddingBottom: 8 },
  backText: { fontSize: 15, color: colors.teal, fontWeight: "600", fontFamily: "Quicksand_600SemiBold" },

  heroBlock: { alignItems: "center", gap: 10, paddingVertical: 16 },
  heroText: {
    fontSize: 34,
    fontWeight: "800",
    fontFamily: "Quicksand_700Bold",
    letterSpacing: -1.2,
    color: colors.foreground,
    textAlign: "center",
    lineHeight: 40,
  },
  subText: { fontSize: 15, fontFamily: "Quicksand_400Regular", color: colors.muted, textAlign: "center" },

  appleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: "#000000",
  },
  appleBtnText: { fontSize: 14, fontWeight: "500", fontFamily: "Quicksand_500Medium", color: colors.white },

  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  googleBtnText: { fontSize: 14, fontWeight: "500", fontFamily: "Quicksand_500Medium", color: colors.foreground },

  phoneBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  otpInput: {
    textAlign: "center",
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Quicksand_400Regular",
    letterSpacing: 0,
  },

  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: {
    fontSize: 11,
    fontWeight: "500",
    fontFamily: "Quicksand_500Medium",
    color: colors.muted,
    letterSpacing: 1,
  },

  inputs: { gap: 10 },
  input: {
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 18,
    fontSize: 15,
    fontFamily: "Quicksand_400Regular",
    letterSpacing: 0,
    color: colors.foreground,
  },

  submitBtn: { marginTop: 4 },

  toggleBtn: { alignItems: "center", paddingVertical: 4 },
  toggleText: { fontSize: 14, fontFamily: "Quicksand_400Regular", color: colors.muted },
  toggleTextBold: { color: colors.teal, fontWeight: "700", fontFamily: "Quicksand_700Bold" },

  legal: {
    fontSize: 11,
    fontFamily: "Quicksand_400Regular",
    color: colors.muted,
    textAlign: "center",
    lineHeight: 16,
    paddingTop: 8,
  },
  legalLink: {
    fontFamily: "Quicksand_400Regular",
    color: colors.teal,
    textDecorationLine: "underline",
  },
});