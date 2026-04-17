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

// Sunny-voiced notification copy
export const NOTIFICATION_COPY = {
  joinRequest: (activityTitle: string) => ({
    title: "someone wants to tandem.",
    body: `a new request for "${activityTitle}". go check them out.`,
  }),
  approved: (activityTitle: string) => ({
    title: "you're in.",
    body: `your request for "${activityTitle}" was approved. time to make a plan.`,
  }),
  rejected: (activityTitle: string) => ({
    title: "not this time.",
    body: `"${activityTitle}" didn't work out. there's more out there.`,
  }),
  sayHey: (senderName: string) => ({
    title: `${senderName} said hey.`,
    body: "go say something back.",
  }),
  activityTomorrow: (activityTitle: string) => ({
    title: "tomorrow. just so you know.",
    body: `"${activityTitle}" is happening tomorrow. don't bail.`,
  }),
  newMessage: (senderName: string) => ({
    title: `${senderName} messaged you.`,
    body: "sunny thinks you should reply.",
  }),
};
