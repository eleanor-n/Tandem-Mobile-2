import React from "react";
import { Text, TextProps, Platform } from "react-native";

export function EmojiText({ children, style, ...props }: TextProps) {
  return (
    <Text
      {...props}
      style={[style, { fontFamily: Platform.OS === "ios" ? "System" : "sans-serif" }]}
    >
      {children}
    </Text>
  );
}
