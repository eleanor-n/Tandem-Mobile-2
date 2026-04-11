import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients, radius, shadows } from "../theme";

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  variant?: "brand" | "outline" | "ghost" | "dark";
}

export const GradientButton = ({
  label,
  onPress,
  loading,
  disabled,
  style,
  textStyle,
  variant = "brand",
}: GradientButtonProps) => {
  if (variant === "brand") {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.88}
        style={[{ borderRadius: radius.full }, shadows.brand, style]}
      >
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.brandInner}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={[styles.brandText, textStyle]}>{label}</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (variant === "outline") {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.88}
        style={[styles.outlineBtn, style]}
      >
        <Text style={[styles.outlineText, textStyle]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  if (variant === "dark") {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.88}
        style={[styles.darkBtn, style]}
      >
        <Text style={[styles.darkText, textStyle]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  // ghost
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.7} style={style}>
      <Text style={[styles.ghostText, textStyle]}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  brandInner: {
    height: 54,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  brandText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Quicksand_600SemiBold",
    letterSpacing: -0.2,
  },
  outlineBtn: {
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  outlineText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "Quicksand_500Medium",
  },
  darkBtn: {
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.foreground,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  darkText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "Quicksand_500Medium",
  },
  ghostText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "Quicksand_500Medium",
  },
});
