import { supabase } from "./supabase";

export interface TrustProfile {
  firstName: string;
  pronouns: string | null;
  selfieVerified: boolean;
  phoneVerified: boolean;
  eduVerified: boolean;
  createdAt: string | null;
}

export async function getTrustProfile(userId: string): Promise<TrustProfile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("first_name, pronouns, selfie_verified, phone_verified, edu_verified, created_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    firstName: data.first_name ?? "",
    pronouns: data.pronouns ?? null,
    selfieVerified: data.selfie_verified ?? false,
    phoneVerified: data.phone_verified ?? false,
    eduVerified: data.edu_verified ?? false,
    createdAt: data.created_at ?? null,
  };
}

// Data source for tandem count.
// To swap to completed_hangs once that flow is built, change only this function.
export async function getTandemsCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from("tandems")
    .select("id", { count: "exact", head: true })
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);
  return count ?? 0;
}

export async function getSharedTandemsCount(
  viewerId: string,
  targetId: string
): Promise<number> {
  const { data } = await supabase.rpc("count_shared_tandems", {
    user_a: viewerId,
    user_b: targetId,
  });
  return typeof data === "number" ? data : 0;
}
