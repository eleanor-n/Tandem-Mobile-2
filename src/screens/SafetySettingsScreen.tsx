import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius } from "../theme";

interface SafetySettingsScreenProps {
  onBack: () => void;
}

export const SafetySettingsScreen = ({ onBack }: SafetySettingsScreenProps) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.teal} />
          <Text style={s.backText}>back</Text>
        </TouchableOpacity>
        <Text style={s.title}>safety</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <View style={s.iconWrap}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.teal} />
          </View>
          <Text style={s.body}>
            safety controls are coming soon. for now, you can block anyone in their profile or report a post in the post menu.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2, width: 60 },
  backText: { fontSize: 14, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.teal },
  title: { fontSize: 18, fontWeight: "800", fontFamily: "Quicksand_700Bold", color: colors.foreground },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Quicksand_400Regular",
    color: colors.secondary,
    lineHeight: 22,
  },
});
