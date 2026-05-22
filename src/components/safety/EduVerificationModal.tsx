import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadows, gradients } from "../../theme";
import { supabase } from "../../lib/supabase";

interface Props {
  visible: boolean;
  onClose: () => void;
  onVerified: () => void;
  onSkip: () => void;
  // When false, the modal cannot be dismissed without successful verification:
  // no X button, no skip link. Used for mandatory onboarding gating.
  dismissible?: boolean;
}

const RESEND_THROTTLE_SECONDS = 60;

export function EduVerificationModal({ visible, onClose, onVerified, onSkip, dismissible = true }: Props) {
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState<"email" | "otp" | "done">("email");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const inputs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (!visible) {
      setStage("email");
      setEmail("");
      setEmailError(null);
      setCode(["", "", "", "", "", ""]);
      setOtpError(null);
      setResendCountdown(0);
    }
  }, [visible]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  const validateEmail = (val: string): string | null => {
    const v = val.trim().toLowerCase();
    if (!v) return "Please enter your school email.";
    if (!v.endsWith(".edu")) return "That doesn't look like a .edu address.";
    if (!/^[^\s@]+@[^\s@]+\.edu$/.test(v)) return "Please enter a valid email.";
    if (!v.endsWith("@umich.edu")) return "Tandem is currently only for UMich students";
    return null;
  };

  const handleSendCode = async () => {
    const err = validateEmail(email);
    if (err) {
      setEmailError(err);
      return;
    }
    setEmailError(null);
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-edu-otp", {
        body: { email: email.trim().toLowerCase() },
      });
      if (error || (data as any)?.error) {
        setEmailError((data as any)?.error ?? "Couldn't send the code. Try again.");
        setSending(false);
        return;
      }
      setStage("otp");
      setResendCountdown(RESEND_THROTTLE_SECONDS);
      setTimeout(() => inputs.current[0]?.focus(), 200);
    } catch {
      setEmailError("Couldn't send the code. Try again.");
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0 || sending) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-edu-otp", {
        body: { email: email.trim().toLowerCase() },
      });
      if (error || (data as any)?.error) {
        setOtpError((data as any)?.error ?? "couldn't resend. try again.");
      } else {
        setResendCountdown(RESEND_THROTTLE_SECONDS);
        setOtpError(null);
      }
    } catch {
      setOtpError("couldn't resend. try again.");
    } finally {
      setSending(false);
    }
  };

  const handleCodeChange = (idx: number, val: string) => {
    const digit = val.replace(/[^0-9]/g, "").slice(-1);
    const next = [...code];
    next[idx] = digit;
    setCode(next);
    setOtpError(null);
    if (digit && idx < 5) {
      inputs.current[idx + 1]?.focus();
    }
  };

  const handleCodeKeyPress = (idx: number, key: string) => {
    if (key === "Backspace" && !code[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const joined = code.join("");
    if (joined.length !== 6) {
      setOtpError("Enter all 6 digits.");
      return;
    }
    setOtpError(null);
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-edu-otp", {
        body: { email: email.trim().toLowerCase(), code: joined },
      });
      if (error || (data as any)?.error) {
        setOtpError((data as any)?.error ?? "that code didn't match. try again.");
        setVerifying(false);
        return;
      }
      setStage("done");
      setVerifying(false);
      setTimeout(() => {
        onVerified();
      }, 1400);
    } catch {
      setOtpError("that code didn't match. try again.");
      setVerifying(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Backdrop is non-dismissing — taps must hit the X or in-modal buttons.
            Prevents stray taps leaking through during the open-transition. */}
        <View style={s.backdropTouchable} pointerEvents="none" />
        <View style={[s.card, { paddingBottom: insets.bottom + 24 }]}>
          <View style={s.handle} />

          {dismissible && (
            <TouchableOpacity style={s.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}

          {stage === "email" && (
            <>
              <Text style={s.sunnyLine}>
                first thing. gotta make sure you're actually a student. tandem's umich-only right now. drop your .edu email and we'll send you a code.
              </Text>
              <Text style={s.label}>school email</Text>
              <TextInput
                style={[s.input, emailError ? s.inputError : null]}
                placeholder="you@umich.edu"
                placeholderTextColor={colors.muted}
                value={email}
                onChangeText={(t) => { setEmail(t); if (emailError) setEmailError(null); }}
                onBlur={() => {
                  if (email.trim()) {
                    const err = validateEmail(email);
                    if (err) setEmailError(err);
                  }
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!sending}
              />
              {emailError ? <Text style={s.errorText}>{emailError}</Text> : null}

              <TouchableOpacity
                onPress={handleSendCode}
                disabled={sending}
                activeOpacity={0.88}
                style={{ marginTop: 20 }}
              >
                <LinearGradient
                  colors={gradients.brand}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.primaryBtn}
                >
                  {sending ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={s.primaryBtnText}>send me the code</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {dismissible && (
                <TouchableOpacity onPress={onSkip} activeOpacity={0.7} style={s.skipBtn}>
                  <Text style={s.skipBtnText}>skip for now</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {stage === "otp" && (
            <>
              <Text style={s.sunnyLine}>okay check your inbox. should be there in like 30 seconds.</Text>
              <Text style={s.sentToText}>{email.trim().toLowerCase()}</Text>

              <View style={s.otpRow}>
                {code.map((digit, idx) => (
                  <TextInput
                    key={idx}
                    ref={(el) => { inputs.current[idx] = el; }}
                    value={digit}
                    onChangeText={(v) => handleCodeChange(idx, v)}
                    onKeyPress={({ nativeEvent }) => handleCodeKeyPress(idx, nativeEvent.key)}
                    style={[s.otpBox, otpError ? s.inputError : null]}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                    editable={!verifying}
                  />
                ))}
              </View>
              {otpError ? <Text style={s.errorText}>{otpError}</Text> : null}

              <TouchableOpacity
                onPress={handleVerify}
                disabled={verifying || code.some((c) => !c)}
                activeOpacity={0.88}
                style={{ marginTop: 20 }}
              >
                <LinearGradient
                  colors={gradients.brand}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[s.primaryBtn, code.some((c) => !c) && s.primaryBtnDisabled]}
                >
                  {verifying ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={s.primaryBtnText}>Verify</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleResend}
                disabled={resendCountdown > 0 || sending}
                activeOpacity={0.7}
                style={s.skipBtn}
              >
                <Text style={s.skipBtnText}>
                  {resendCountdown > 0 ? `resend in ${resendCountdown}s` : "resend code"}
                </Text>
              </TouchableOpacity>

              {dismissible && (
                <TouchableOpacity onPress={onSkip} activeOpacity={0.7} style={s.skipBtn}>
                  <Text style={s.skipBtnText}>skip for now</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {stage === "done" && (
            <View style={s.doneWrap}>
              <View style={s.doneCheck}>
                <Ionicons name="checkmark" size={28} color={colors.white} />
              </View>
              <Text style={s.doneLine}>verified! that's the hard part.</Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  backdropTouchable: {
    flex: 1,
  },
  card: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 24,
    paddingTop: 12,
    ...shadows.float,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 4,
  },
  sunnyLine: {
    fontFamily: "Fraunces_500Medium_Italic",
    fontSize: 22,
    fontStyle: "italic",
    color: colors.foreground,
    textAlign: "center",
    lineHeight: 28,
    marginTop: 8,
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontFamily: "Quicksand_700Bold",
    color: colors.muted,
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  input: {
    height: 50,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.foreground,
    fontFamily: "Quicksand_500Medium",
  },
  inputError: {
    borderColor: "#DC2626",
  },
  errorText: {
    fontSize: 13,
    color: "#DC2626",
    fontFamily: "Quicksand_500Medium",
    marginTop: 8,
    paddingHorizontal: 4,
  },
  primaryBtn: {
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontSize: 15,
    color: colors.white,
    fontFamily: "Quicksand_700Bold",
  },
  skipBtn: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  skipBtnText: {
    fontSize: 14,
    color: colors.muted,
    fontFamily: "Quicksand_500Medium",
  },
  sentToText: {
    fontSize: 13,
    color: colors.muted,
    fontFamily: "Quicksand_500Medium",
    textAlign: "center",
    marginTop: -16,
    marginBottom: 24,
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  otpBox: {
    flex: 1,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    textAlign: "center",
    fontSize: 22,
    fontFamily: "Quicksand_700Bold",
    color: colors.foreground,
  },
  doneWrap: {
    alignItems: "center",
    paddingVertical: 36,
  },
  doneCheck: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  doneLine: {
    fontFamily: "Fraunces_500Medium_Italic",
    fontSize: 22,
    fontStyle: "italic",
    color: colors.foreground,
    textAlign: "center",
  },
});
