// SUPABASE: Run this SQL if expo_push_token column does not exist:
// alter table public.profiles
//   add column if not exists expo_push_token text;
//
// Edge function triggers needed (create in Supabase Dashboard → Database → Webhooks):
// 1. On INSERT to join_requests → notify post owner
// 2. On UPDATE of join_requests to status='accepted' → notify requester
// 3. On INSERT to messages → notify other tandem participant

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { supabase } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;

    // Save token to Supabase profiles table
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ expo_push_token: token } as any)
        .eq("user_id", user.id);
    }

    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    return token;
  } catch (err) {
    console.log("[Notifications] register error:", err);
    return null;
  }
}

export async function sendLocalNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });
}

// Locked notification templates.
// Sunny voice (lowercase, soft): connection/activity/social triggers.
// Tandem voice (sentence case): safety/payment/account triggers.
export const NOTIFICATION_COPY = {
  // Sunny voice
  joinRequest: (requesterName: string) => ({
    title: "company incoming.",
    body: `${requesterName} just joined your tandem.`,
  }),
  approved: () => ({
    title: "locked in.",
    body: "see you there.",
  }),
  postFirstJoin: () => ({
    title: "someone said yes.",
    body: "",
  }),
  newMessage: (senderName: string, messageText: string) => ({
    title: senderName,
    body: messageText,
  }),
  // Tandem voice
  verificationApproved: () => ({
    title: "Your profile is verified.",
    body: "Welcome to Tandem.",
  }),
  verificationNeeded: () => ({
    title: "Verify your identity to start tandeming.",
    body: "",
  }),
};
