import { StatusBar } from "expo-status-bar";
import { useState, useEffect } from "react";
import { View, ActivityIndicator, Linking, Alert } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
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
import { supabase } from "./src/lib/supabase";
import { colors } from "./src/theme";

type Tab = "Discover" | "Map" | "Scrapbook" | "Profile";
type UnauthScreen = "welcome" | "auth";

const AppInner = () => {
  const { user, loading, onboardingCompleted, refreshOnboarding } = useAuth();
  const [unauthScreen, setUnauthScreen] = useState<UnauthScreen>("welcome");
  const [activeTab, setActiveTab] = useState<Tab>("Discover");
  const [showSettings, setShowSettings] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [showMembership, setShowMembership] = useState(false);
  const [activeChat, setActiveChat] = useState<{ id: string; name: string; photo: string } | null>(null);

  // Deep link handler for Google OAuth callback
  useEffect(() => {
    const handleUrl = async ({ url }: { url: string }) => {
      if (!url.startsWith("tandem://")) return;
      try {
        const parsedUrl = new URL(url);
        const hash = parsedUrl.hash.substring(1);
        const params = new URLSearchParams(hash || parsedUrl.search);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        } else {
          const code = params.get("code");
          if (code) await supabase.auth.exchangeCodeForSession(url);
        }
      } catch (e) {
        console.error("Deep link error:", e);
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

  // ── Logged in, onboarding not done → Sunny ─────────────────
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
              onboarding_completed: true,
            }, { onConflict: "user_id" });
            if (error) throw error;
          } catch (err: any) {
            Alert.alert("Something went wrong", err.message || "Could not save your profile. Please try again.");
            return;
          }
          // Re-fetch profile so onboardingCompleted flips to true → routes to Discover
          await refreshOnboarding();
        }}
      />
    );
  }

  // ── Logged in, onboarding done → Main app ─────────────────

  // Overlay screens (highest priority first)
  if (activeChat) {
    return <ChatScreen convo={activeChat} onBack={() => setActiveChat(null)} />;
  }
  if (showMessages) {
    return (
      <MessagesScreen
        onBack={() => setShowMessages(false)}
        onOpenChat={(c) => setActiveChat(c)}
      />
    );
  }
  if (showSettings) {
    return (
      <SettingsScreen
        onBack={() => setShowSettings(false)}
        onMembershipPress={() => { setShowSettings(false); setShowMembership(true); }}
      />
    );
  }
  if (showMembership) {
    return <MembershipScreen onBack={() => setShowMembership(false)} />;
  }

  const tabProps = { activeTab, onTabPress: (t: string) => setActiveTab(t as Tab) };

  switch (activeTab) {
    case "Map":       return <MapScreen {...tabProps} />;
    case "Scrapbook": return <ScrapbookScreen {...tabProps} onMembershipPress={() => setShowMembership(true)} />;
    case "Profile":
      return (
        <ProfileScreen
          {...tabProps}
          onSettingsPress={() => setShowSettings(true)}
          onMembershipPress={() => setShowMembership(true)}
          onMessagesPress={() => setShowMessages(true)}
        />
      );
    default:
      return (
        <DiscoverScreen
          {...tabProps}
          onMessagesPress={() => setShowMessages(true)}
          onMembershipPress={() => setShowMembership(true)}
        />
      );
  }
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
