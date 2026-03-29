import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export type Tier = "free" | "go" | "trail";

export const FREE_IM_IN_LIMIT = 3;

export function useMembershipTier() {
  const { user } = useAuth();
  const [tier, setTier] = useState<Tier>("free");
  const [imInCount, setImInCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from("profiles")
      .select("membership_tier, im_in_count, im_in_reset_at")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.membership_tier) setTier((data.membership_tier as Tier) || "free");
        if (data?.im_in_reset_at) {
          const resetAt = new Date(data.im_in_reset_at);
          if (new Date() > resetAt) {
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
            supabase.from("profiles").update({ im_in_count: 0, im_in_reset_at: nextMonth.toISOString() } as any).eq("user_id", user.id);
            setImInCount(0);
          } else {
            setImInCount(data.im_in_count ?? 0);
          }
        } else {
          setImInCount(data?.im_in_count ?? 0);
        }
        setLoading(false);
      });
  }, [user]);

  const isLimited = tier === "free" && imInCount >= FREE_IM_IN_LIMIT;

  const incrementImIn = async () => {
    if (!user || tier !== "free") return;
    const next = imInCount + 1;
    setImInCount(next);
    const resetAt = new Date();
    resetAt.setMonth(resetAt.getMonth() + 1, 1);
    await supabase.from("profiles").update({ im_in_count: next, im_in_reset_at: resetAt.toISOString() } as any).eq("user_id", user.id);
  };

  return { tier, imInCount, isLimited, incrementImIn, loading };
}
