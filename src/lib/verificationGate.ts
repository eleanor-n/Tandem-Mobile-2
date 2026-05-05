// verificationGate — soft gate for unverified users.
// Returns a hook that exposes verification status and a modal trigger.
// Pair with <VerificationGateModal /> from src/components/safety/VerificationGateModal.tsx.

import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import { useAuth } from "../contexts/AuthContext";

interface VerificationState {
  isVerified: boolean;
  hasSelfieUploaded: boolean;
  loading: boolean;
}

let cached: { userId: string; state: VerificationState } | null = null;

export async function fetchVerificationState(userId: string): Promise<VerificationState> {
  const { data } = await supabase
    .from("profiles")
    .select("selfie_verified, selfie_url")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    isVerified: !!data?.selfie_verified,
    hasSelfieUploaded: !!data?.selfie_url,
    loading: false,
  };
}

export interface VerificationGateController {
  isVerified: boolean;
  hasSelfieUploaded: boolean;
  loading: boolean;
  gateVisible: boolean;
  showGate: () => void;
  hideGate: () => void;
  refresh: () => Promise<void>;
}

export function useVerificationGate(): VerificationGateController {
  const { user } = useAuth();
  const [state, setState] = useState<VerificationState>(() =>
    cached && user && cached.userId === user.id
      ? cached.state
      : { isVerified: false, hasSelfieUploaded: false, loading: true }
  );
  const [gateVisible, setGateVisible] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    const next = await fetchVerificationState(user.id);
    cached = { userId: user.id, state: next };
    setState(next);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (cached && cached.userId === user.id) {
      setState(cached.state);
      return;
    }
    refresh();
  }, [user, refresh]);

  return {
    isVerified: state.isVerified,
    hasSelfieUploaded: state.hasSelfieUploaded,
    loading: state.loading,
    gateVisible,
    showGate: () => setGateVisible(true),
    hideGate: () => setGateVisible(false),
    refresh,
  };
}
