import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "../theme";

interface PremiumLockProps {
  tier: "go" | "trail";
  featureName: string;
  onPress?: () => void;
}

export function PremiumLock({ tier, featureName, onPress }: PremiumLockProps) {
  return (
    <TouchableOpacity style={s.wrap} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name="lock-closed" size={13} color={colors.muted} />
      <Text style={s.name}>{featureName}</Text>
      <View style={[s.badge, tier === "trail" && s.badgeTrail]}>
        <Text style={s.badgeText}>{tier === "go" ? "tandem go" : "tandem trail"}</Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 6, opacity: 0.6 },
  name: { fontSize: 13, fontStyle: "italic", color: colors.muted, flex: 1 },
  badge: { backgroundColor: colors.tintTeal, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTrail: { backgroundColor: "#EEF4FE" },
  badgeText: { fontSize: 10, fontWeight: "700", color: colors.teal },
});
