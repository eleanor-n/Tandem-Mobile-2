import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, KeyboardAvoidingView,
  Platform, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { TandemLogo } from "../components/TandemLogo";
import { GradientButton } from "../components/GradientButton";
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

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const redirectUrl = "tandem://auth/callback";

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No auth URL returned");

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl,
        { preferEphemeralSession: true }
      );

      if (result.type === "success" && result.url) {
        // Try hash params first (implicit flow), then query params (PKCE flow)
        let accessToken: string | null = null;
        let refreshToken: string | null = null;
        let code: string | null = null;

        try {
          const parsedUrl = new URL(result.url);

          // Hash fragment (implicit flow)
          if (parsedUrl.hash && parsedUrl.hash.length > 1) {
            const hashParams = new URLSearchParams(parsedUrl.hash.substring(1));
            accessToken = hashParams.get("access_token");
            refreshToken = hashParams.get("refresh_token");
          }

          // Query params (PKCE/code flow)
          if (!accessToken) {
            const queryParams = new URLSearchParams(parsedUrl.search);
            code = queryParams.get("code");
            accessToken = queryParams.get("access_token");
            refreshToken = queryParams.get("refresh_token");
          }
        } catch {
          // URL parsing failed — try raw string approach
          const hashIndex = result.url.indexOf("#");
          if (hashIndex !== -1) {
            const hashParams = new URLSearchParams(result.url.substring(hashIndex + 1));
            accessToken = hashParams.get("access_token");
            refreshToken = hashParams.get("refresh_token");
          }
        }

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        } else if (code) {
          await supabase.auth.exchangeCodeForSession(result.url);
        } else {
          throw new Error("Could not extract auth tokens from redirect URL.");
        }
      } else if (result.type === "cancel") {
        // User closed the browser — no error needed
      } else {
        throw new Error("Google sign in was not completed.");
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
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        {/* Logo + hero */}
        <View style={styles.heroBlock}>
          <TandemLogo size="lg" showWordmark />
          <Text style={styles.heroText}>
            {mode === "signin" ? "Welcome\nback." : "Create your\naccount."}
          </Text>
          <Text style={styles.subText}>
            {mode === "signin" ? "Sign in to find your people." : "Join Tandem. It's free."}
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
              <Text style={styles.googleG}>G</Text>
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email + Password */}
        <View style={styles.inputs}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </View>

        {/* Submit */}
        <GradientButton
          label={loading ? "..." : mode === "signin" ? "Sign in" : "Create account"}
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
            {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
            <Text style={styles.toggleTextBold}>
              {mode === "signin" ? "Sign up" : "Sign in"}
            </Text>
          </Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          By continuing, you agree to Tandem's Terms of Service and Privacy Policy.
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
  googleG: { fontSize: 15, fontWeight: "700", color: "#4285F4" },
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
});