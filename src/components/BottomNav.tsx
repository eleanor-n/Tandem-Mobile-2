import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, gradients, radius } from "../theme";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const TABS = ["Discover", "Map", "Post", "Scrapbook", "Profile"] as const;

const ICONS: Record<string, { active: IoniconName; inactive: IoniconName }> = {
  Discover:  { active: "home",     inactive: "home-outline"     },
  Map:       { active: "location", inactive: "location-outline" },
  Post:      { active: "add",      inactive: "add"              },
  Scrapbook: { active: "book",     inactive: "book-outline"     },
  Profile:   { active: "person",   inactive: "person-outline"   },
};

interface BottomNavProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
  onPostPress?: () => void;
}

export const BottomNav = ({ activeTab, onTabPress, onPostPress }: BottomNavProps) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab;
        const icon = ICONS[tab];

        if (tab === "Post") {
          return (
          
            <TouchableOpacity
            key={tab}
            onPress={onPostPress}
            activeOpacity={0.85}
            style={s.centerTab}
          >
            
              <View style={s.centerBtnOuter}>
                <LinearGradient
                  colors={gradients.brand}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.centerBtn}
                >
                  <Ionicons name="add" size={28} color={colors.white} />
                </LinearGradient>
              </View>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={tab}
            onPress={() => onTabPress(tab)}
            activeOpacity={0.7}
            style={s.tab}
          >
            <Ionicons
              name={isActive ? icon.active : icon.inactive}
              size={22}
              color={isActive ? colors.teal : colors.muted}
            />
            <Text style={[s.label, isActive && s.labelActive]}>
              {tab.toLowerCase()}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row",
    backgroundColor: colors.background,
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: 8, paddingHorizontal: 4,
    alignItems: "flex-end",
  },
  tab: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 4 },
  centerTab: { flex: 1, alignItems: "center", paddingBottom: 4 },
  centerBtnOuter: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.background,
    shadowColor: "#2DD4BF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginTop: -18,
  },
  centerBtn: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: "center", justifyContent: "center",
  },
  label: { fontSize: 10, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.muted, letterSpacing: 0.1 },
  labelActive: { color: colors.teal },
});
