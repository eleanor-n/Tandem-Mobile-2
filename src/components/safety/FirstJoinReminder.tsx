import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, shadows } from "../../theme";

interface Props {
  visible: boolean;
  onPress: () => void;
  onDismiss: () => void;
}

export function FirstJoinReminder({ visible, onPress, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <View style={[s.wrap, { bottom: insets.bottom + 12 }]} pointerEvents="box-none">
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={s.banner}
        accessibilityRole="button"
        accessibilityLabel="open safety controls"
      >
        <Text style={s.line}>if anything ever feels off, you can tap here.</Text>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={s.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="dismiss"
        >
          <Ionicons name="close" size={16} color={colors.muted} />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingRight: 36,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  line: {
    flex: 1,
    fontFamily: "Caveat_700Bold",
    fontSize: 18,
    fontStyle: "italic",
    color: colors.foreground,
    lineHeight: 22,
  },
  closeBtn: {
    position: "absolute",
    top: 8,
    right: 10,
    padding: 4,
  },
});
