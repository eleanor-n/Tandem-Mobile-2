import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { colors, radius } from "../theme";

interface ResetPasswordScreenProps {
  onComplete: () => void;
}

export const ResetPasswordScreen = ({ onComplete }: ResetPasswordScreenProps) => {
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!password.trim()) {
      Alert.alert("enter a new password", "");
      return;
    }
    if (password !== confirm) {
      Alert.alert("passwords don't match", "");
      return;
    }
    if (password.length < 8) {
      Alert.alert("password too short", "use at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Alert.alert("password updated", "you can sign in with your new password.", [
        { text: "ok", onPress: onComplete },
      ]);
    } catch (err: any) {
      Alert.alert("couldn't reset password", err.message || "try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[s.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={s.title}>set a new password</Text>
      <Text style={s.sub}>choose something you'll remember.</Text>

      <TextInput
        style={s.input}
        placeholder="new password"
        placeholderTextColor={colors.muted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        autoComplete="new-password"
      />
      <TextInput
        style={s.input}
        placeholder="confirm password"
        placeholderTextColor={colors.muted}
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        autoComplete="new-password"
      />

      <TouchableOpacity style={s.btn} onPress={handleReset} activeOpacity={0.88} disabled={loading}>
        {loading
          ? <ActivityIndicator color={colors.white} />
          : <Text style={s.btnText}>reset password</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={onComplete} activeOpacity={0.7} style={{ alignSelf: "center", paddingTop: 12 }}>
        <Text style={s.cancel}>back to sign in</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 28, gap: 14 },
  title: { fontSize: 26, fontWeight: "800", fontFamily: "Quicksand_700Bold", color: colors.foreground, letterSpacing: -0.6 },
  sub: { fontSize: 14, fontFamily: "Quicksand_400Regular", color: colors.muted },
  input: {
    height: 52, borderRadius: radius.lg, backgroundColor: "#fff",
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: 18, fontSize: 15,
    fontFamily: "Quicksand_400Regular", color: colors.foreground,
  },
  btn: { height: 52, borderRadius: radius.full, backgroundColor: colors.teal, alignItems: "center", justifyContent: "center", marginTop: 4 },
  btnText: { fontSize: 15, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.white },
  cancel: { fontSize: 14, color: colors.muted, fontFamily: "Quicksand_400Regular" },
});
