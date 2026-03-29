import React from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import SunnyAvatar from "./SunnyAvatar";
import { colors, radius, shadows, gradients } from "../theme";

interface UpsellSheetProps {
  visible: boolean;
  onDismiss: () => void;
  onUpgrade: () => void;
  headline: string;
  subtext: string;
}

export function UpsellSheet({ visible, onDismiss, onUpgrade, headline, subtext }: UpsellSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onDismiss}>
        <TouchableOpacity activeOpacity={1} style={s.sheet} onPress={() => {}}>
          <View style={s.handle} />
          <SunnyAvatar expression="warm" size={60} />
          <Text style={s.headline}>{headline}</Text>
          <Text style={s.subtext}>{subtext}</Text>
          <TouchableOpacity style={s.upgradeBtn} onPress={onUpgrade} activeOpacity={0.88}>
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.upgradeBtnInner}>
              <Text style={s.upgradeBtnText}>see membership</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDismiss} style={s.laterBtn} activeOpacity={0.7}>
            <Text style={s.laterText}>maybe later</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 28, paddingBottom: 40, alignItems: "center", gap: 12,
  },
  handle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, marginBottom: 8 },
  headline: { fontSize: 20, fontWeight: "800", color: colors.foreground, textAlign: "center", letterSpacing: -0.4 },
  subtext: { fontSize: 14, color: colors.muted, textAlign: "center", maxWidth: 280, lineHeight: 21 },
  upgradeBtn: { width: "100%", height: 52, borderRadius: radius.full, overflow: "hidden", marginTop: 8, ...shadows.brand },
  upgradeBtnInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  upgradeBtnText: { fontSize: 15, fontWeight: "700", color: colors.white },
  laterBtn: { paddingVertical: 8 },
  laterText: { fontSize: 14, color: colors.muted, fontWeight: "500" },
});
