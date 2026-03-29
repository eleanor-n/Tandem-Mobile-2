# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start dev server (scan QR with Expo Go or simulator)
npx expo start

# Run on specific platform
npx expo run:ios
npx expo run:android
npx expo start --web

# Install dependencies
npm install
```

## Architecture Overview

**Tandem** is a React Native/Expo social discovery app. The entry point is `App.tsx`, which controls all navigation and screen state directly (no navigation library like React Navigation — screens are conditionally rendered based on state).

### Navigation Model

`App.tsx` manages the entire screen stack via state booleans and the auth context. The flow is:

1. **Unauthenticated** → `WelcomeScreen` → `AuthScreen`
2. **Authenticated, onboarding incomplete** → `SunnyScreen` (collects profile data)
3. **Authenticated + onboarded** → Tab bar with `DiscoverScreen`, `MapScreen`, `ScrapbookScreen`, `ProfileScreen`
4. **Overlay screens** rendered on top of tabs via additional state: `ChatScreen`, `MessagesScreen`, `SettingsScreen`, `MembershipScreen`

`PrivacyScreen` and `TermsScreen` are also shown as overlays from `WelcomeScreen`.

### Auth & Session

- `src/contexts/AuthContext.tsx` — wraps the app, exposes `user`, `session`, `loading`, `onboardingCompleted`, `signOut`, `refreshOnboarding`
- Auth is Supabase-backed with PKCE OAuth flow; deep link scheme is `tandem://` for OAuth callbacks
- `onboardingCompleted` is read from the `profiles` table; call `refreshOnboarding()` after the user finishes `SunnyScreen`

### Backend

- `src/lib/supabase.ts` — single Supabase client instance, sessions persisted in AsyncStorage
- All Supabase calls go through this client directly from screens/hooks (no service layer)
- Relevant Supabase table: `profiles` (stores `onboarding_completed` and all profile fields)

### Design System

All visual constants live in `src/theme/index.ts` — import `colors`, `typography`, `radius`, `shadows` from there. Do not hardcode colors or font sizes inline.

Key brand colors: teal `#2DD4BF`, blue `#3B82F6`, cream background `#FAFAF6`.

### Component Conventions

- `src/components/` — shared UI components. Notable ones:
  - `GradientButton` — primary CTA button with teal/blue gradient
  - `BottomNav` — custom tab bar rendered inside `App.tsx`
  - `UpsellSheet` — modal for premium upgrade prompts
  - `PremiumLock` — overlay for gating premium features
- Screen components accept callback props for navigation (e.g. `onBack`, `onNavigate`) since there's no navigation library
- All screens use `useSafeAreaInsets()` from `react-native-safe-area-context` for notch/home indicator spacing

### Membership

`src/hooks/useMembershipTier.ts` — hook that reads the user's membership tier from Supabase. Used by screens to conditionally show `PremiumLock` or `UpsellSheet`.
