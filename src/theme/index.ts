// Tandem design tokens — v2 design system
export const colors = {
  // Backgrounds
  background: "#FAFAF6",       // warm cream
  card: "#FFFFFF",
  surface: "#F3F4F6",

  // Brand
  teal: "#2DD4BF",             // lighter teal
  blue: "#3B82F6",

  // Text
  foreground: "#0F172A",
  muted: "#9CA3AF",
  secondary: "#374151",

  // Border
  border: "#E5E7EB",

  // Tints
  tintTeal: "#F0FDFB",
  tintBlue: "#EEF4FE",

  // Status
  destructive: "#DC2626",

  // White/Black
  white: "#FFFFFF",
  black: "#000000",
};

export const gradients = {
  brand: ["#2DD4BF", "#3B82F6"] as [string, string],
  brandAngle: 135,
};

export const typography = {
  hero: { fontSize: 36, fontWeight: "800" as const, letterSpacing: -1.2, lineHeight: 40 },
  screenTitle: { fontSize: 26, fontWeight: "700" as const, letterSpacing: -0.5 },
  cardName: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.4 },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 22 },
  tag: { fontSize: 12, fontWeight: "500" as const },
  micro: { fontSize: 11, fontWeight: "500" as const },
  label: { fontSize: 10, fontWeight: "700" as const, letterSpacing: 1.2 },
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 20,
  full: 999,
};

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  brand: {
    shadowColor: "#2DD4BF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  float: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
};
