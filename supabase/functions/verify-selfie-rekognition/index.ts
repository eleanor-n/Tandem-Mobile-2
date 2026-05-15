// Selfie verification via AWS Rekognition CompareFaces.
// Deploy: supabase functions deploy verify-selfie-rekognition
// Required secrets:
//   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION (us-east-1)
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "jsr:@supabase/supabase-js@2";
import { RekognitionClient, CompareFacesCommand } from "npm:@aws-sdk/client-rekognition@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SIMILARITY_AUTO_APPROVE = 85;
const SIMILARITY_FLAG_REVIEW_MIN = 60;

type Status = "approved" | "pending_review" | "rejected";

async function bytesFromSupabaseStorage(
  supabaseService: ReturnType<typeof createClient>,
  bucket: string,
  path: string,
): Promise<Uint8Array> {
  const { data, error } = await supabaseService.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`download failed: ${error?.message ?? "no data"}`);
  return new Uint8Array(await data.arrayBuffer());
}

async function bytesFromUrl(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseService = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up the user's selfie path + profile photo.
    const { data: profile, error: profileErr } = await supabaseService
      .from("profiles")
      .select("avatar_url, selfie_url")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileErr) throw profileErr;
    if (!profile) {
      return new Response(JSON.stringify({ error: "profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const avatarUrl = (profile as any).avatar_url as string | null;
    const selfiePath = (profile as any).selfie_url as string | null;

    if (!avatarUrl) {
      return new Response(
        JSON.stringify({
          error: "MISSING_PROFILE_PHOTO",
          message: "Please add a profile photo before verifying your selfie",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!selfiePath) {
      return new Response(
        JSON.stringify({ error: "MISSING_SELFIE", message: "no selfie has been uploaded yet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Download both images.
    let selfieBytes: Uint8Array;
    let avatarBytes: Uint8Array;
    try {
      [selfieBytes, avatarBytes] = await Promise.all([
        bytesFromSupabaseStorage(supabaseService, "selfies", selfiePath),
        bytesFromUrl(avatarUrl),
      ]);
    } catch (err: any) {
      console.error("[rekognition] image download failed:", err?.message ?? err);
      await supabaseService
        .from("profiles")
        .update({
          selfie_verification_status: "pending_review",
          selfie_reviewed_at: new Date().toISOString(),
        } as any)
        .eq("user_id", user.id);
      return new Response(
        JSON.stringify({
          status: "pending_review",
          message: "we're double-checking. we'll get back to you within 24 hours.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Call Rekognition CompareFaces.
    const rekognition = new RekognitionClient({
      region: Deno.env.get("AWS_REGION") ?? "us-east-1",
      credentials: {
        accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
        secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
      },
    });

    let similarity: number | null = null;
    let status: Status = "pending_review";

    try {
      const cmd = new CompareFacesCommand({
        SourceImage: { Bytes: avatarBytes },
        TargetImage: { Bytes: selfieBytes },
        SimilarityThreshold: SIMILARITY_FLAG_REVIEW_MIN,
      });
      const result = await rekognition.send(cmd);

      const matches = result.FaceMatches ?? [];
      const unmatched = result.UnmatchedFaces ?? [];
      const topMatch = matches.length > 0
        ? matches.reduce((acc, m) => ((m.Similarity ?? 0) > (acc.Similarity ?? 0) ? m : acc))
        : null;

      if (topMatch && typeof topMatch.Similarity === "number") {
        similarity = topMatch.Similarity;
        if (similarity >= SIMILARITY_AUTO_APPROVE) {
          status = "approved";
        } else {
          status = "pending_review";
        }
      } else if (unmatched.length > 0) {
        // Face detected in selfie but didn't match the avatar.
        status = "rejected";
      } else {
        // No face detected in selfie or both — treat as rejected so user retakes.
        status = "rejected";
      }
    } catch (err: any) {
      console.error("[rekognition] CompareFaces error:", err?.name, err?.message ?? err);
      // Safe default — queue for human review.
      status = "pending_review";
    }

    const nowIso = new Date().toISOString();
    const profileUpdate: Record<string, any> = {
      selfie_verification_status: status,
      selfie_similarity_score: similarity,
      selfie_reviewed_at: nowIso,
    };
    if (status === "approved") {
      profileUpdate.selfie_verified = true;
    } else if (status === "rejected") {
      // Clear the rejected selfie so the admin queue stays clean and the user
      // is prompted to retake.
      profileUpdate.selfie_url = null;
      profileUpdate.selfie_verified = false;
      try {
        await supabaseService.storage.from("selfies").remove([selfiePath]);
      } catch { /* best-effort */ }
    }

    await supabaseService.from("profiles").update(profileUpdate as any).eq("user_id", user.id);

    const message =
      status === "approved"
        ? "you're verified."
        : status === "pending_review"
          ? "we're double-checking. we'll get back to you within 24 hours."
          : "your selfie didn't match your profile photo. take another with your face clearly visible.";

    return new Response(
      JSON.stringify({ status, similarity, message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[rekognition] uncaught error:", err?.message ?? err);
    return new Response(
      JSON.stringify({ error: err?.message ?? String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
