import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, KeyboardAvoidingView,
  Platform, ScrollView, Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { TandemLogo } from "../components/TandemLogo";
import { GradientButton } from "../components/GradientButton";
import { AntDesign } from "@expo/vector-icons";
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
      const redirectUrl = "tandem://";

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error("No auth URL returned from Supabase");

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl,
        { preferEphemeralSession: true }
      );

      if (result.type === "cancel") return;

      if (result.type === "success" && result.url) {
        const url = result.url;

        // Try PKCE code exchange first
        if (url.includes("code=")) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(url);
          if (exchangeError) throw exchangeError;
          return;
        }

        // Try hash fragment
        const hashIndex = url.indexOf("#");
        if (hashIndex !== -1) {
          const params = new URLSearchParams(url.substring(hashIndex + 1));
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) throw sessionError;
            return;
          }
        }

        // Try query params
        const queryIndex = url.indexOf("?");
        if (queryIndex !== -1) {
          const params = new URLSearchParams(url.substring(queryIndex + 1));
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          const code = params.get("code");
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            return;
          }
          if (code) {
            await supabase.auth.exchangeCodeForSession(url);
            return;
          }
        }

        throw new Error("Could not extract auth tokens from redirect URL: " + url);
      }
    } catch (err: any) {
      Alert.alert("Google sign in failed", err.message || "Something went wrong.");
    } finally {
      setGoogleLoading(false);
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
        {/* Back */}
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>back</Text>
        </TouchableOpacity>

        {/* Logo + hero */}
        <View style={styles.heroBlock}>
          <TandemLogo size="lg" showWordmark />
          <Text style={styles.heroText}>
            {mode === "signin" ? "welcome\nback." : "let's get\nyou in."}
          </Text>
          <Text style={styles.subText}>
            {mode === "signin" ? "find your people. never go alone." : "join tandem. it's free."}
          </Text>
        </View>

        {/* Google button */}
        <TouchableOpacity
          onPress={handleGoogleSignIn}
          disabled={googleLoading || loading}
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
  backText: { fontSize: 15, color: colors.teal, fontWeight: "600" },

  heroBlock: { alignItems: "center", gap: 10, paddingVertical: 16 },
  heroText: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1.2,
    color: colors.foreground,
    textAlign: "center",
    lineHeight: 40,
  },
  subText: { fontSize: 15, color: colors.muted, textAlign: "center" },

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
  googleBtnText: { fontSize: 14, fontWeight: "500", color: colors.foreground },

  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: {
    fontSize: 11,
    fontWeight: "500",
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
    color: colors.foreground,
  },

  submitBtn: { marginTop: 4 },

  toggleBtn: { alignItems: "center", paddingVertical: 4 },
  toggleText: { fontSize: 14, color: colors.muted },
  toggleTextBold: { color: colors.teal, fontWeight: "700" },

  legal: {
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 16,
    paddingTop: 8,
  },
  legalLink: {
    color: colors.teal,
    textDecorationLine: "underline",
  },
});