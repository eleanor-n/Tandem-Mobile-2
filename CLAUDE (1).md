# CLAUDE.md — Tandem Mobile

> This file is the single source of truth for AI-assisted development on Tandem. Read it fully before making any changes. When in doubt, refer back here.

---

## What Is Tandem?

Tandem is a **platonic social connection app** where users post activity-based listings to find companions for everyday experiences — so they never have to do things alone. It is **not** a dating app, not a networking app, and not a social feed. The activity is the icebreaker. The companion makes the memory.

**Tagline:** *"The activity is the icebreaker. The companion makes the memory."*

**Platform:** iOS-first native mobile app (React Native / Expo)  
**Project path:** `~/Desktop/tandem-native`  
**Supabase project ID:** `ccntlaunczirvntnsjbm`  
**Website:** thetandemweb.com  
**Contact:** tandemapp.hq@gmail.com

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo (TypeScript) |
| Backend / DB | Supabase (project: `ccntlaunczirvntnsjbm`) |
| Auth | Supabase Auth — email/password + Google OAuth (via `expo-auth-session`) |
| Push notifications | OneSignal (`EXPO_PUBLIC_ONESIGNAL_APP_ID` in `.env`) |
| Payments | Stripe (live key, `pk_live_...`) |
| Email | Resend — from `eleanor@thetandemweb.com`, reply-to `tandemapp.hq@gmail.com` |
| Navigation | State-based in `App.tsx` (no navigation library — screens render conditionally) |
| Maps | `react-native-maps` with a clean minimal map style (not colorful/default) |
| Build system | EAS (Expo Application Services) |

---

## Commands

```bash
# Start dev server (Expo Go or simulator)
npx expo start
npx expo start --go --tunnel --clear   # tunnel mode with cache clear (preferred)

# Run on specific platform
npx expo run:ios
npx expo run:android
npx expo start --web

# Install dependencies — always use --legacy-peer-deps
npm install --legacy-peer-deps

# After any npm install, re-run pods
cd ios && pod install

# EAS production/TestFlight build
eas build --platform ios --profile preview
```

---

## SDK & Native Setup

**Current versions:** Expo SDK 54, React Native 0.81.5, React 19.1.0, Hermes engine, New Architecture **disabled**.

### iOS AppDelegate — CRITICAL

`AppDelegate` inherits from **`RCTAppDelegate`** (not `EXAppDelegateWrapper`). In SDK 54, `EXAppDelegateWrapper` no longer inherits from `RCTAppDelegate`, so the React Native factory and window are never created if you use it. **Do not change this inheritance.**

```objc
// AppDelegate.h — correct
@interface AppDelegate : RCTAppDelegate
```

The `bundleURL` method uses `.expo/.virtual-metro-entry` as the bundle root for Metro in debug.

### Corrupt node_modules

`react-native` and some native packages (e.g. `react-native-safe-area-context`) can install as corrupt stubs (12 files instead of 4000+). If `pod install` fails with `"cannot load such file -- .../react_native_pods"`, the scripts directory is missing. Fix:

```bash
cd /tmp && npm pack react-native@0.81.5
mkdir rn-tmp && tar xzf react-native-0.81.5.tgz -C rn-tmp
cp -r rn-tmp/package/scripts node_modules/react-native/
cp -r rn-tmp/package/Libraries node_modules/react-native/
cp -r rn-tmp/package/React node_modules/react-native/
cp -r rn-tmp/package/ReactCommon node_modules/react-native/
```

Or do a full clean install:
```bash
rm -rf node_modules package-lock.json && npm install --legacy-peer-deps
```

### New Architecture

Disabled in both `app.json` (`"newArchEnabled": false`) and `ios/Podfile.properties.json` (`"newArchEnabled": "false"`). **Keep it disabled** — enabling it causes a black screen on launch with the current setup.

### expo-dev-client

**Not installed. Do not install it.** Version 6.0.20 crashes on launch with `fatalError("Cannot find the keyWindow")` on iOS 18/19 simulators. The app connects to Metro directly via `RCTBundleURLProvider` using `localhost:8081`.

---

## Architecture Overview

### Navigation Model

`App.tsx` is the **entire navigation controller** — there is no React Navigation or Expo Router. All screens are conditionally rendered based on state booleans and the auth context. Do not introduce a navigation library without a full refactor.

**Screen flow:**
1. **Unauthenticated** → `WelcomeScreen` → `AuthScreen`
2. **Authenticated, onboarding incomplete** → `SunnyScreen` (collects profile data)
3. **Authenticated + onboarded** → Tab bar with `DiscoverScreen`, `MapScreen`, `ScrapbookScreen`, `ProfileScreen`
4. **Overlay screens** rendered on top of tabs via additional state booleans: `ChatScreen`, `MessagesScreen`, `SettingsScreen`, `MembershipScreen`
5. `PrivacyScreen` and `TermsScreen` are overlays from `WelcomeScreen`

Screen components accept callback props for navigation (e.g. `onBack`, `onNavigate`) — this is intentional since there is no navigation library.

### Auth & Session

- `src/contexts/AuthContext.tsx` — wraps the entire app, exposes `user`, `session`, `loading`, `onboardingCompleted`, `signOut`, `refreshOnboarding`
- Auth is Supabase-backed with **PKCE OAuth flow**; deep link scheme is `tandem://` for OAuth callbacks
- `onboardingCompleted` is read from the `profiles` table — call `refreshOnboarding()` after the user finishes `SunnyScreen`

### Backend Pattern

- `src/lib/supabase.ts` — single Supabase client instance, sessions persisted via AsyncStorage
- All Supabase calls go directly from screens/hooks — there is no service layer abstraction
- Do not add a service layer without a discussion first

### Theme & Design Tokens

All visual constants live in **`src/theme/index.ts`** — import `colors`, `typography`, `radius`, `shadows` from there. **Do not hardcode colors or font sizes inline.** This is how the design system is enforced in code.

### Key Shared Components

Located in `src/components/`:

| Component | Purpose |
|---|---|
| `GradientButton` | Primary CTA — teal/blue gradient, use for all main actions |
| `BottomNav` | Custom tab bar rendered inside `App.tsx` |
| `UpsellSheet` | Modal for premium upgrade prompts |
| `PremiumLock` | Overlay for gating premium-only features |

All screens use `useSafeAreaInsets()` from `react-native-safe-area-context` for notch/home indicator spacing. Don't skip this.

### Membership Hook

`src/hooks/useMembershipTier.ts` — reads the user's membership tier from Supabase. Used by screens to conditionally render `PremiumLock` or `UpsellSheet`. Always go through this hook — do not query `profiles.membership_tier` directly in screen components.

---

## Environment Variables (`.env`)

```
EXPO_PUBLIC_SUPABASE_URL=https://ccntlaunczirvntnsjbm.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
EXPO_PUBLIC_ONESIGNAL_APP_ID=6ff11a5c-9d87-4370-86ba-d28e4e9a1b31
```

Stripe and Resend keys live in Supabase Edge Function secrets — never in the `.env` file.

---

## Supabase Schema

### `profiles`
Extends Supabase auth users. Fields include: `id`, `full_name`, `display_name`, `bio`, `avatar_url`, `location`, `age`, `gender`, `membership_tier` (`free` | `go` | `trail`), `created_at`.

### `activities`
Core table for all user-created posts. Key fields:
- `id`, `user_id` (host), `title`, `description`, `activity_date`, `activity_time`
- `location_name`, `location_lat`, `location_lng`
- `tags` (text[]), `status` (`active` | `completed` | `cancelled`)
- `is_group` (boolean), `max_participants`, `accepted_user_id`
- Audience filters: `audience_gender`, `audience_age_min/max`, `audience_distance`, `audience_ethnicity`, `audience_political`, `audience_religion`, `audience_sexuality`
- `created_at`

### `tandems`
Confirmed pairings between two users around an activity: `id`, `user_a_id`, `user_b_id`, `activity_id`, `created_at`.

### `messages`
Chat messages within a tandem: `id`, `tandem_id`, `sender_id`, `content`, `created_at`.

### `activity_interactions`
User actions on activities: `id`, `activity_id`, `user_id`, `action` (`join_request` | `save` | `decline`), `created_at`.

### `blocked_users`
`id`, `blocker_id`, `blocked_id`, `created_at`.

### `user_reports`
`id`, `reporter_id`, `reported_id`, `reason`, `created_at`.

---

## Brand & Design System

**Apply these rules to every single screen and component. No exceptions.**

### Colors

| Token | Value | Usage |
|---|---|---|
| Background | `#FAFAF6` | Every screen background. Never pure white, never teal. |
| Teal accent | `#2DD4BF` | Icons, active states, borders, teal checkmarks |
| Blue accent | `#3B82F6` | Gradient endpoint only |
| Gradient | `teal → blue` | Buttons, active pills, tier cards, send buttons |
| Dark text | `#0F172A` | Headlines, names |
| Body text | `#374151` | Descriptions, body copy |
| Muted text | `#6B7280` | Timestamps, secondary info |
| Border gray | `#E5E7EB` | Cards, input borders |

The teal-to-blue gradient is NEVER used as a full screen background. It's for accents, buttons, and small UI elements only.

### Typography

- **Headlines / labels:** Quicksand Bold — friendly, rounded, lowercase-friendly
- **Body text:** System font (SF Pro on iOS)
- **Tone:** Casual, warm, never corporate. Lowercase in UI copy is intentional.

### Emoji Rules — CRITICAL

Emoji `<Text>` elements must use `fontFamily: 'System'` inline and must **never** be nested inside another `<Text>`. Always place them as siblings in a `<View flexDirection="row">`.

```jsx
// CORRECT
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
  <Text style={{ fontFamily: 'System', fontSize: 16 }}>☕</Text>
  <Text style={styles.label}>Coffee run</Text>
</View>

// WRONG — causes [?] box
<Text style={{ fontFamily: 'Quicksand-Bold' }}>☕ Coffee run</Text>

// ALSO WRONG — emoji nested inside another Text
<Text style={styles.label}><Text>☕</Text> Coffee run</Text>
```

Note: An `EmojiText` component exists in the codebase but is no longer used in the main screens. Do not reintroduce it.

This applies everywhere: filter pills, map markers, scrapbook cards, notification rows, anywhere an emoji appears.

### Mascot: Sunny

Sunny is Tandem's sun mascot. Sunny appears in: empty states, onboarding, loading moments. Sunny's voice is warm, lowercase, slightly self-aware, with understated dry humor. Never pushy, never corporate.

Examples of Sunny voice:
- *"nothing here yet. your first adventure is waiting."*
- *"you haven't joined anything yet. that's what we're here for."*
- *"activities you join will show up here."*

Sunny should NOT be used as an aggressive upsell mechanism. No big gradient "UPGRADE NOW" banners in Sunny's empty states.

### Card Design — Activity Cards

Tandem is activity-first, not person-first. Cards show what's happening, not who the person is.

**Activity card structure:**
```
┌─────────────────────────────────┐
│  Activity photo (full width)    │
│  [category emoji + name pill]   │  ← bottom-left overlay on photo
├─────────────────────────────────┤
│  Activity title (bold, 18px)    │
│  📍 location · distance (teal)  │
│  🗓 date · time (gray)          │
│                                 │
│  ┌──────────────────────────┐   │
│  │ "host's description..."  │   │  ← italic, teal left border
│  └──────────────────────────┘   │
│                                 │
│  [avatars] 2 going              │
├─────────────────────────────────┤
│  [avatar] hosted by [firstname] │  ← first name only, NO age
│  [one line host bio]            │
└─────────────────────────────────┘
```

**Never show on a card:** age next to name, dating-profile prompts ("YOU BOTH", "MY COMFORT SHOW", etc.), Instagram-style layout.

---

## Screens

### Screen Inventory

Since navigation is state-based in `App.tsx`, there are no URL routes. Screens are referenced by component name.

| Screen | Component | Status |
|---|---|---|
| Welcome | `WelcomeScreen` | Built |
| Auth / Sign In | `AuthScreen` | Built — email/password + Google OAuth (Google OAuth only works in EAS build, not Expo Go) |
| Onboarding | `SunnyScreen` | Built — photo upload has issues |
| Discover (Browse) | `DiscoverScreen` | Built — filter pills, Browse/My Activity toggle, activity cards |
| Map | `MapScreen` | Built — use clean minimal map style |
| Scrapbook | `ScrapbookScreen` | Built |
| Profile | `ProfileScreen` | Built |
| Messages List | `MessagesScreen` | Built |
| Chat | `ChatScreen` | Built |
| Settings | `SettingsScreen` | Built — overlay on top of tabs |
| Membership Tiers | `MembershipScreen` | Built — overlay on top of tabs |
| Privacy | `PrivacyScreen` | Built — overlay from WelcomeScreen |
| Terms | `TermsScreen` | Built — overlay from WelcomeScreen |

### Bottom Tab Bar

Tabs: **Discover, Map, Post (center CTA), Messages, Profile**  
Active tab icon: teal (`#2DD4BF`)  
Inactive: `#6B7280`

---

## Membership Tiers

| Tier | Price | Key Features |
|---|---|---|
| **Free** | $0 | Browse, post, join activities, basic filters |
| **Tandem Go** | Paid (monthly) | Unlimited joins, advanced audience filters, go badge, scrapbook |
| **Tandem Trail** | Paid (higher) | All Go features + priority listing, trail badge, analytics |

Membership cards in `/settings/membership`:
- **Free:** white card, `#E5E7EB` border
- **Tandem Go:** white card, teal border glow + "most popular" gradient pill
- **Tandem Trail:** teal-to-blue gradient card, white text throughout

---

## Known Bugs & Do-Not-Break Rules

### Active Known Issues

1. **Google OAuth in Expo Go** — Google sign-in fails in Expo Go due to deep link limitations. This is expected and intentional. It will work in the EAS standalone build. Do not try to "fix" this by changing the OAuth flow — just note it.

2. **Emoji rendering `[?]` boxes** — Any emoji in a `<Text>` with a custom font will render as `[?]`. Always isolate emojis per the rule above. This affects: map markers, filter pills, scrapbook tags, notification icons.

3. **Photo upload in onboarding** — Image upload during onboarding is not yet working correctly. Do not remove the UI; it needs to be fixed, not deleted.

4. **OneSignal in Expo Go** — OneSignal is commented out throughout the codebase so the app can run in Expo Go. Do NOT uncomment or re-enable OneSignal unless doing an EAS build. The comments are intentional.

5. **Map style** — Use a clean, minimal map style. The default colorful/green style looks wrong. Do not revert to default.

### Do-Not-Break Rules

- **Never hardcode credentials.** All keys/URLs come from `.env` or Supabase Edge Function secrets.
- **Never show age on any user-facing UI.** No "Maya, 22" anywhere. First name only.
- **Never make the background pure white (`#FFFFFF`).** Always `#FAFAF6`.
- **Never use teal/gradient as a full screen background.**
- **Never add dating-profile style fields** (YOU BOTH, comfort show, etc.) to activity cards.
- **Never delete OneSignal code** — it's commented out intentionally, not removed.
- **Email confirmation is turned OFF** in Supabase Auth. Do not turn it back on.
- **Supabase project is `ccntlaunczirvntnsjbm`** — do not reference the old Loveable project (`aoyznsnupyhlkjdrbwyy`) anywhere.

---

## Third-Party Services

### Supabase
- Project URL: `https://ccntlaunczirvntnsjbm.supabase.co`
- Auth providers enabled: Email/password (no email confirmation), Google OAuth
- Edge Functions: waitlist email handler (sends via Resend)
- RLS is enabled on all new tables by default

### OneSignal
- App ID: `6ff11a5c-9d87-4370-86ba-d28e4e9a1b31`
- Currently commented out in the codebase — only works in EAS production builds
- Do not remove or uncomment unless building with EAS

### Stripe
- Live key (not test mode) — real transactions
- Used for Tandem Go and Tandem Trail subscription payments
- Stripe secret key lives in Supabase Edge Function secrets only

### Resend
- Domain: `thetandemweb.com` (verified)
- From address: `eleanor@thetandemweb.com`
- Reply-to: `tandemapp.hq@gmail.com`
- Used for: waitlist confirmation emails, admin notifications
- API key lives in Supabase Edge Function secrets only

---

## Development Workflow

### Running the App

```bash
cd ~/Desktop/tandem-native
npx expo start --go --tunnel --clear
```

Press `i` in terminal to open iOS Simulator.

### Common Issues

**"Invalid supabaseUrl"** → `.env` file has a duplicated or malformed URL. Check for double-pasting like `EXPO_PUBLIC_SUPABASE_URL=EXPO_PUBLIC_SUPABASE_URL=https://...`

**"native module doesn't exist"** → OneSignal is un-commented somewhere. Find and re-comment it.

**App not reflecting changes** → Press `r` in the terminal to reload, or restart with `--clear` flag.

**Xcode build issues** → Try clearing derived data: `rm -rf ~/Library/Developer/Xcode/DerivedData`

**EAS build** is required for: Google OAuth, OneSignal push notifications, any native module testing.

---

## Voice & Copy Guidelines

All UI copy should sound like Sunny — or like Eleanor wrote it herself.

- Lowercase headers and CTAs are intentional
- No corporate language ("connect with your community", "leverage your network")
- Short, warm, specific ("find someone to join you" not "discover new connections")
- Empty states are friendly and a little self-aware, never aggressive upsells
- Error messages are human ("something went wrong. try again?" not "Error 500")
- CTAs: "i'm in →", "let's go", "find your person", "post a plan"

---

*Last updated: March 2026*
