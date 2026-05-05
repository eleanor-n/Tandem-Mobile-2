import AsyncStorage from "@react-native-async-storage/async-storage";

const FIRST_JOIN_KEY = "tandem_first_join_reminder_shown";

export async function hasSeenFirstJoinReminder(): Promise<boolean> {
  const v = await AsyncStorage.getItem(FIRST_JOIN_KEY);
  return v === "true";
}

export async function markFirstJoinReminderSeen(): Promise<void> {
  await AsyncStorage.setItem(FIRST_JOIN_KEY, "true");
}
