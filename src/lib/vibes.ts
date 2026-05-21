// Shared types for the Vibing Now feature. The VibingCard component that
// originally owned this type was removed; its visuals were inlined into
// VibeDetailSheet so the type now lives in a neutral location.

import type { TrustTier } from "./trustService";

export interface VibeFeedItem {
  id: string;
  user_id: string;
  vibe_preset: string;
  emoji: string | null;
  duration_minutes: number;
  audience: string;
  current_lat: number;
  current_lng: number;
  location_label: string | null;
  expires_at: string;
  created_at: string;
  // Joined from profiles for rendering
  user_first_name?: string | null;
  user_avatar_url?: string | null;
  user_trust_tier?: TrustTier;
  user_birthday?: string | null;
}
