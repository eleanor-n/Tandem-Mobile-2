// SENTRY SETUP (uncomment after installing):
// 1. npm install sentry-expo @sentry/react-native --legacy-peer-deps
// 2. cd ios && pod install
// 3. Create a project at sentry.io → React Native → copy the DSN
// 4. Add to .env: EXPO_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
// 5. Uncomment the Sentry lines below and in the export default
// import * as Sentry from 'sentry-expo';
// Sentry.init({
//   dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
//   enableInExpoDevelopment: false,
//   debug: __DEV__,
// });

import { StatusBar } from "expo-status-bar";
import { useState, useEffect, useRef } from "react";
import {
  useFonts,
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
} from "@expo-google-fonts/quicksand";
import { Caveat_400Regular, Caveat_700Bold } from "@expo-google-fonts/caveat";
import { View, ActivityIndicator, Linking, Alert, Animated, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { WelcomeScreen } from "./src/screens/WelcomeScreen";
import { AuthScreen } from "./src/screens/AuthScreen";
import { SunnyScreen } from "./src/screens/SunnyScreen";
import { DiscoverScreen } from "./src/screens/DiscoverScreen";
import { MapScreen } from "./src/screens/MapScreen";
import { ScrapbookScreen } from "./src/screens/ScrapbookScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { MessagesScreen } from "./src/screens/MessagesScreen";
import { ChatScreen } from "./src/screens/ChatScreen";
import { MembershipScreen } from "./src/screens/MembershipScreen";
import { SafetySettingsScreen } from "./src/screens/SafetySettingsScreen";
import { SplashAnimationScreen } from "./src/screens/SplashAnimationScreen";
import { ResetPasswordScreen } from "./src/screens/ResetPasswordScreen";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TrustStackPreview = __DEV__ ? require("./src/screens/_dev/TrustStackPreview").TrustStackPreview : null;
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./src/lib/supabase";
import { colors } from "./src/theme";
import { getSunnyResponse } from "./src/lib/sunny";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import PlacesAutocomplete from "expo-google-places-autocomplete";

type Tab = "Discover" | "Map" | "Chat" | "Profile";
type UnauthScreen = "welcome" | "auth" | "resetPassword";

const AppInner = () => {
  const { user, loading, onboardingCompleted, refreshOnboarding } = useAuth();
  const [unauthScreen, setUnauthScreen] = useState<UnauthScreen>("welcome");
  const [activeTab, setActiveTab] = useState<Tab>("Discover");
  const [showSettings, setShowSettings] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  const [showMembership, setShowMembership] = useState(false);
  const [showScrapbook, setShowScrapbook] = useState(false);
  const [showDevPreview, setShowDevPreview] = useState(false);
  const [activeChat, setActiveChat] = useState<{ id: string; name: string; photo: string; age?: number } | null>(null);
  const [showSplash, setShowSplash] = useState(false);
  const [showPost, setShowPost] = useState(false);
  const [showMyActivity, setShowMyActivity] = useState(false);
  const [postPrefill, setPostPrefill] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [sunnyToast, setSunnyToast] = useState<string | null>(null);
  const sunnyToastOpacity = useRef(new Animated.Value(0)).current;
  const sunnyWelcomed = useRef(false);

  useEffect(() => {
    if (!onboardingCompleted || !user || showSplash || sunnyWelcomed.current) return;
    const checkWelcome = async () => {
      const seen = await AsyncStorage.getItem("tandem_sunny_welcomed");
      if (seen) return;
      sunnyWelcomed.current = true;
      await AsyncStorage.setItem("tandem_sunny_welcomed", "true");
      const text = await getSunnyResponse({ context: "firstLogin", userName: user.email?.split("@")[0] });
      if (!text) return;
      setSunnyToast(text);
      sunnyToastOpacity.setValue(0);
      Animated.timing(sunnyToastOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      setTimeout(() => {
        Animated.timing(sunnyToastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => setSunnyToast(null));
      }, 3500);
    };
    checkWelcome();
  }, [onboardingCompleted, user, showSplash]);

  useEffect(() => {
    const checkFirstLaunch = async () => {
      const hasOnboarded = await AsyncStorage.getItem("tandem_has_onboarded");
      const splashKey = `splash_seen_${user?.id ?? "unknown"}`;
      if (!hasOnboarded) {
        // Existing user who used the app before the splash feature was added
        await AsyncStorage.multiSet([
          ["tandem_has_onboarded", "true"],
          [splashKey, "true"],
        ]);
        return;
      }
      const seen = await AsyncStorage.getItem(splashKey);
      if (!seen) {
        setShowSplash(true);
      }
    };
    if (onboardingCompleted === true) checkFirstLaunch();
  }, [onboardingCompleted]);

  // Request location + notification permissions once after onboarding completes
  useEffect(() => {
    if (onboardingCompleted !== true) return;
    const requestPermissions = async () => {
      const seen = await AsyncStorage.getItem("tandem_permissions_requested");
      if (seen) return;
      await AsyncStorage.setItem("tandem_permissions_requested", "true");

      const { status: locStatus } = await Location.getForegroundPermissionsAsync();
      if (locStatus !== "granted") {
        await Location.requestForegroundPermissionsAsync();
      }

      const { status: notifStatus } = await Notifications.getPermissionsAsync();
      if (notifStatus !== "granted") {
        await Notifications.requestPermissionsAsync();
      }
    };
    requestPermissions();
  }, [onboardingCompleted]);

  // Deep link handler for OAuth callbacks (Google, Apple)
  useEffect(() => {
    const handleUrl = async ({ url }: { url: string }) => {
      if (!url) return;
      // Only process tandem:// deep links
      if (!url.startsWith("tandem://")) return;
      // Password reset deep link
      if (url.includes("auth/reset") || url.includes("type=recovery")) {
        setUnauthScreen("resetPassword");
        // Let Supabase parse the recovery token from the URL
        const hashIndex = url.indexOf("#");
        if (hashIndex !== -1) {
          const params = new URLSearchParams(url.substring(hashIndex + 1));
          const at = params.get("access_token");
          const rt = params.get("refresh_token");
          if (at && rt) {
            await supabase.auth.setSession({ access_token: at, refresh_token: rt });
          }
        }
        return;
      }
      console.log("[OAuth] deep link received:", url);
      try {
        // 1. PKCE code in query string (most common with Supabase PKCE flow)
        const qIndex = url.indexOf("?");
        if (qIndex !== -1) {
          const params = new URLSearchParams(url.substring(qIndex + 1));
          const code = params.get("code");
          const at = params.get("access_token");
          const rt = params.get("refresh_token");
          if (code) {
            console.log("[OAuth] exchanging PKCE code");
            const { error } = await supabase.auth.exchangeCodeForSession(url);
            if (error) console.error("[OAuth] exchangeCodeForSession error:", error.message);
            else console.log("[OAuth] PKCE exchange success");
            return;
          }
          if (at && rt) {
            console.log("[OAuth] setting session from query tokens");
            const { error } = await supabase.auth.setSession({ access_token: at, refresh_token: rt });
            if (error) console.error("[OAuth] setSession error:", error.message);
            else console.log("[OAuth] setSession success");
            return;
          }
        }
        // 2. Hash fragment tokens (implicit flow fallback)
        const hashIndex = url.indexOf("#");
        if (hashIndex !== -1) {
          const params = new URLSearchParams(url.substring(hashIndex + 1));
          const at = params.get("access_token");
          const rt = params.get("refresh_token");
          const code = params.get("code");
          if (at && rt) {
            console.log("[OAuth] setting session from hash tokens");
            const { error } = await supabase.auth.setSession({ access_token: at, refresh_token: rt });
            if (error) console.error("[OAuth] setSession error:", error.message);
            else console.log("[OAuth] setSession success");
            return;
          }
          if (code) {
            console.log("[OAuth] exchanging PKCE code from hash");
            await supabase.auth.exchangeCodeForSession(url);
            return;
          }
        }
        // 3. Code in path (e.g. tandem://auth/callback?code=...)
        if (url.includes("code=")) {
          console.log("[OAuth] exchanging code (path match)");
          await supabase.auth.exchangeCodeForSession(url);
          return;
        }
        console.log("[OAuth] deep link had no recognizable auth params:", url);
      } catch (e: any) {
        console.error("[OAuth] deep link error:", e.message);
      }
    };
    Linking.getInitialURL().then(url => { if (url) handleUrl({ url }); });
    const sub = Linking.addEventListener("url", handleUrl);
    return () => sub.remove();
  }, []);

  // Loading state — checking session or profile (covers new-signup race)
  if (loading || (user && onboardingCompleted === null)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.teal} size="large" />
      </View>
    );
  }

  // ── Not logged in ──────────────────────────────────────────
  if (!user) {
    if (unauthScreen === "resetPassword") {
      return <ResetPasswordScreen onComplete={() => setUnauthScreen("auth")} />;
    }
    if (unauthScreen === "auth") {
      return <AuthScreen onBack={() => setUnauthScreen("welcome")} />;
    }
    return (
      <WelcomeScreen
        onGetStarted={() => setUnauthScreen("auth")}
        onSignIn={() => setUnauthScreen("auth")}
        onGoogleSignIn={() => setUnauthScreen("auth")}
      />
    );
  }

  // ── Logged in, onboarding not done → Sunny ────────
  if (onboardingCompleted === false) {
    return (
      <SunnyScreen
        onComplete={async (data) => {
          try {
            const deepPrompt = data.deep_prompt;
            const deepPrompts = deepPrompt?.prompt_question
              ? { [deepPrompt.prompt_question]: deepPrompt.prompt_answer }
              : deepPrompt && typeof deepPrompt === "string"
              ? { prompt: deepPrompt }
              : {};

            console.log("[Onboarding] deepPrompts being saved:", JSON.stringify(deepPrompts));
            console.log("[Onboarding] full data received:", JSON.stringify(data));
            const { error } = await supabase.from("profiles").upsert({
              user_id: user.id,
              first_name: data.name || data.first_name,
              birthday: data.birthday,
              gender: data.gender,
              occupation: data.occupation,
              personality_type: data.personality || data.mbti,
              humor_type: Array.isArray(data.humor) ? data.humor : [],
              usage_reasons: Array.isArray(data.usage) ? data.usage : [],
              quick_prompts: {
                ...(data.ideal_saturday ? { ideal_saturday: data.ideal_saturday } : {}),
                ...(data.friend_who ? { friend_who: data.friend_who } : {}),
              },
              deep_prompts: deepPrompts,
              photos: Array.isArray(data.photos) && data.photos.length > 0 ? data.photos : [],
              // avatar_url is the primary field ProfileScreen reads; photos[] is the fallback.
              // Both must be set here so the profile photo shows immediately after onboarding.
              avatar_url: (Array.isArray(data.photos) && data.photos[0]) ? data.photos[0] : null,
              onboarding_completed: true,
            }, { onConflict: "user_id" });
            if (error) throw error;
          } catch (err: any) {
            Alert.alert("Something went wrong", err.message || "Could not save your profile. Please try again.");
            return;
          }
          // Send welcome email
          try {
            await supabase.functions.invoke("send-welcome-email", {
              body: {
                email: user.email,
                name: data.name || data.first_name || "",
              },
            });
          } catch {
            // Non-blocking — don't fail onboarding if email fails
          }
          // Mark that this user has onboarded so checkFirstLaunch knows to show splash
          await AsyncStorage.setItem("tandem_has_onboarded", "true");
          // Re-fetch profile so onboardingCompleted flips to true → routes to Discover
          await refreshOnboarding();
        }}
      />
    );
  }

  // ── Logged in, onboarding done → Main app ─────────────────
  if (showSplash) {
    return (
      <SplashAnimationScreen
        onComplete={async () => {
          await AsyncStorage.setItem(`splash_seen_${user?.id ?? "unknown"}`, "true");
          setShowSplash(false);
        }}
      />
    );
  }

  // Dev-only preview screen — never compiled into release builds
  if (__DEV__ && showDevPreview && TrustStackPreview) {
    return <TrustStackPreview onBack={() => setShowDevPreview(false)} />;
  }

  // Overlay screens (highest priority first)
  if (showScrapbook) {
    return <ScrapbookScreen activeTab="Scrapbook" onTabPress={(t) => { setShowScrapbook(false); setActiveTab(t as Tab); }} onPostPress={() => { setShowScrapbook(false); setShowPost(true); }} />;
  }
  if (showSafety) {
    return <SafetySettingsScreen onBack={() => setShowSafety(false)} />;
  }
  if (showSettings) {
    return (
      <SettingsScreen
        onBack={() => setShowSettings(false)}
        onMembershipPress={() => { setShowSettings(false); setShowMembership(true); }}
        onSafetyPress={() => { setShowSettings(false); setShowSafety(true); }}
      />
    );
  }
  if (showMembership) {
    return <MembershipScreen onBack={() => setShowMembership(false)} />;
  }

  const onPostPress = () => { setActiveTab("Discover"); setShowPost(true); };
  const tabProps = { activeTab, onTabPress: (t: string) => setActiveTab(t as Tab), onPostPress };

  let tabContent: React.ReactNode;
  switch (activeTab) {
    case "Map":
      tabContent = (
        <MapScreen
          {...tabProps}
          onPostPressWithLocation={(loc) => {
            setPostPrefill(loc);
            setActiveTab("Discover");
            setShowPost(true);
          }}
        />
      );
      break;
    case "Chat":
      tabContent = activeChat
        ? <ChatScreen convo={activeChat} onBack={() => setActiveChat(null)} />
        : <MessagesScreen {...tabProps} onOpenChat={(c) => setActiveChat(c)} />;
      break;
    case "Profile":
      tabContent = (
        <ProfileScreen
          {...tabProps}
          onSettingsPress={() => setShowSettings(true)}
          onMembershipPress={() => setShowMembership(true)}
          onMessagesPress={() => setActiveTab("Chat")}
          onMyActivityPress={() => { setActiveTab("Discover"); setShowMyActivity(true); }}
          onScrapbookPress={() => setShowScrapbook(true)}
        />
      );
      break;
    default:
      tabContent = (
        <DiscoverScreen
          {...tabProps}
          onMessagesPress={() => setActiveTab("Chat")}
          onMembershipPress={() => setShowMembership(true)}
          onOpenChat={(c) => { setActiveTab("Chat"); setActiveChat(c); }}
          openPostModal={showPost}
          onPostModalOpened={() => setShowPost(false)}
          startOnMyActivity={showMyActivity}
          postPrefill={postPrefill}
          onPostPrefillConsumed={() => setPostPrefill(null)}
          onSafetyPress={() => setShowSafety(true)}
        />
      );
  }

  return (
    <View style={{ flex: 1 }}>
      {tabContent}
      {sunnyToast ? (
        <Animated.View style={[appS.sunnyToast, { opacity: sunnyToastOpacity }]} pointerEvents="none">
          <Text style={appS.sunnyToastText}>{sunnyToast}</Text>
        </Animated.View>
      ) : null}
      {__DEV__ ? (
        <TouchableOpacity
          style={appS.devBtn}
          onPress={() => setShowDevPreview(true)}
          activeOpacity={0.8}
        >
          <Text style={appS.devBtnText}>dev</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const appS = StyleSheet.create({
  sunnyToast: {
    position: "absolute",
    bottom: 100,
    left: 24,
    right: 24,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  sunnyToastText: {
    fontStyle: "italic",
    fontSize: 13,
    color: "#888",
    textAlign: "center",
  },
  devBtn: {
    position: "absolute",
    top: 60,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  devBtnText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
});

// Wrap with Sentry once installed:
// export default Sentry.Native.wrap(App);
export default function App() {
  const [fontsLoaded] = useFonts({
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
    Caveat_400Regular,
    Caveat_700Bold,
  });

  useEffect(() => {
    const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (key) PlacesAutocomplete.initPlaces(key);
  }, []);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ErrorBoundary>
        <AuthProvider>
          <AppInner />
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
