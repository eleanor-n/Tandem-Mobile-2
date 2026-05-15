// Auto-generated "what you have in common" context for the request review sheet.
// Replaces the "why I want to join" message — the system surfaces the
// connection points instead of asking the requester to write them.

import { supabase } from "./supabase";

export interface SharedContext {
  sharedInterests: string[];
  mutualTandemers: number;
  sameYear: boolean;
  viewerYear: string | null;
  requesterYear: string | null;
  sharedTandemHistory: { partnerName: string; activityTitle: string }[];
  commonCount: number;
}

const EMPTY: SharedContext = {
  sharedInterests: [],
  mutualTandemers: 0,
  sameYear: false,
  viewerYear: null,
  requesterYear: null,
  sharedTandemHistory: [],
  commonCount: 0,
};

export async function getSharedContext(
  viewerUserId: string,
  requesterUserId: string,
): Promise<SharedContext> {
  if (!viewerUserId || !requesterUserId || viewerUserId === requesterUserId) return EMPTY;

  // Run the profile reads + tandem fetches in parallel.
  const [viewerProfileRes, requesterProfileRes, viewerTandemsRes, requesterTandemsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("year_of_school, usage_reasons, humor_type")
      .eq("user_id", viewerUserId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("year_of_school, usage_reasons, humor_type")
      .eq("user_id", requesterUserId)
      .maybeSingle(),
    supabase
      .from("tandems")
      .select("id, user_a_id, user_b_id, activity_id")
      .or(`user_a_id.eq.${viewerUserId},user_b_id.eq.${viewerUserId}`),
    supabase
      .from("tandems")
      .select("id, user_a_id, user_b_id, activity_id")
      .or(`user_a_id.eq.${requesterUserId},user_b_id.eq.${requesterUserId}`),
  ]);

  const viewerProfile: any = viewerProfileRes.data ?? {};
  const requesterProfile: any = requesterProfileRes.data ?? {};
  const viewerTandems: any[] = viewerTandemsRes.data ?? [];
  const requesterTandems: any[] = requesterTandemsRes.data ?? [];

  // Shared interests — usage_reasons + humor_type, intersected.
  const viewerInterests = new Set<string>([
    ...(Array.isArray(viewerProfile.usage_reasons) ? viewerProfile.usage_reasons : []),
    ...(Array.isArray(viewerProfile.humor_type) ? viewerProfile.humor_type : []),
  ]);
  const requesterInterests = new Set<string>([
    ...(Array.isArray(requesterProfile.usage_reasons) ? requesterProfile.usage_reasons : []),
    ...(Array.isArray(requesterProfile.humor_type) ? requesterProfile.humor_type : []),
  ]);
  const sharedInterests = [...viewerInterests].filter((x) => requesterInterests.has(x));

  // Same year of school.
  const viewerYear = viewerProfile.year_of_school ?? null;
  const requesterYear = requesterProfile.year_of_school ?? null;
  const sameYear = !!(viewerYear && requesterYear && viewerYear === requesterYear);

  // Mutual tandemers: count distinct users who have tandem'd with BOTH viewer
  // and requester (excluding the two of them).
  const viewerPartners = new Set<string>();
  for (const t of viewerTandems) {
    const partner = t.user_a_id === viewerUserId ? t.user_b_id : t.user_a_id;
    if (partner && partner !== viewerUserId) viewerPartners.add(partner);
  }
  const requesterPartners = new Set<string>();
  for (const t of requesterTandems) {
    const partner = t.user_a_id === requesterUserId ? t.user_b_id : t.user_a_id;
    if (partner && partner !== requesterUserId) requesterPartners.add(partner);
  }
  const mutualPartnerIds = [...viewerPartners].filter(
    (id) => requesterPartners.has(id) && id !== requesterUserId,
  );
  const mutualTandemers = mutualPartnerIds.length;

  // Shared tandem history: viewer + requester ever in the same tandem.
  // (Rare for two non-friends, but powerful when present.)
  const viewerTandemIds = new Set(viewerTandems.map((t) => t.id));
  const sharedTandems = requesterTandems.filter((t) => viewerTandemIds.has(t.id));

  let sharedTandemHistory: { partnerName: string; activityTitle: string }[] = [];
  if (sharedTandems.length > 0) {
    const activityIds = sharedTandems.map((t) => t.activity_id).filter(Boolean);
    if (activityIds.length > 0) {
      const { data: acts } = await supabase
        .from("activities")
        .select("id, title, user_id")
        .in("id", activityIds);
      const actMap: Record<string, any> = {};
      for (const a of acts ?? []) actMap[a.id] = a;

      // Look up names of the third-party tandem hosts when applicable.
      const hostIds = (acts ?? []).map((a: any) => a.user_id).filter(Boolean) as string[];
      const { data: hosts } = await supabase
        .from("profiles")
        .select("user_id, first_name")
        .in("user_id", hostIds);
      const hostMap: Record<string, string> = {};
      for (const h of hosts ?? []) hostMap[h.user_id] = h.first_name ?? "";

      sharedTandemHistory = sharedTandems.slice(0, 2).map((t) => ({
        partnerName: hostMap[actMap[t.activity_id]?.user_id ?? ""] ?? "someone",
        activityTitle: actMap[t.activity_id]?.title ?? "a tandem",
      }));
    }
  }

  const commonCount =
    (sameYear ? 1 : 0) +
    (sharedInterests.length > 0 ? 1 : 0) +
    (mutualTandemers > 0 ? 1 : 0) +
    (sharedTandemHistory.length > 0 ? 1 : 0);

  return {
    sharedInterests,
    mutualTandemers,
    sameYear,
    viewerYear,
    requesterYear,
    sharedTandemHistory,
    commonCount,
  };
}
