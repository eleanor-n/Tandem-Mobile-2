// Selfie verification via AWS Rekognition CompareFaces.
// Deploy: supabase functions deploy verify-selfie-rekognition
// Required secrets:
//   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION (us-east-1)
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "jsr:@supabase/supabase-js@2";
import { RekognitionClient, CompareFacesCommand, DetectFacesCommand } from "npm:@aws-sdk/client-rekognition@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SIMILARITY_AUTO_APPROVE = 85;
const SIMILARITY_FLAG_REVIEW_MIN = 60;

type Status = "approved" | "pending_review" | "rejected";

function hexPreview(bytes: Uint8Array): string {
  return Array.from(bytes.slice(0, 16))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}

type ImageFormat = "jpeg" | "png" | "heic" | "empty" | "unknown";

function detectImageFormat(bytes: Uint8Array): ImageFormat {
  if (bytes.length === 0) return "empty";
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  // HEIC: "ftyp" at offset 4
  if (
    bytes.length >= 8 &&
    bytes[4] === 0x66 && // f
    bytes[5] === 0x74 && // t
    bytes[6] === 0x79 && // y
    bytes[7] === 0x70    // p
  ) return "heic";
  return "unknown";
}

async function bytesFromSupabaseStorage(
  supabaseService: ReturnType<typeof createClient>,
  bucket: string,
  path: string,
): Promise<Uint8Array> {
  const { data, error } = await supabaseService.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`download failed: ${error?.message ?? "no data"}`);
  // data is a Blob — explicit two-step conversion per spec.
  const blob = data;
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return bytes;
}

async function bytesFromUrl(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return bytes;
}

// Writes the rejection status to the profile. If clearSelfie is true, also
// nulls out selfie_url and deletes the underlying storage object so the user
// is forced to retake (used for selfie-side failures: bad format, empty,
// Rekognition rejected/error). For avatar-side failures, leaves the selfie
// intact since retaking it won't help.
async function writeRejection(
  supabaseService: ReturnType<typeof createClient>,
  userId: string,
  selfiePath: string | null,
  clearSelfie: boolean,
) {
  const nowIso = new Date().toISOString();
  const update: Record<string, any> = {
    selfie_verification_status: "rejected",
    selfie_reviewed_at: nowIso,
    selfie_verified: false,
  };
  if (clearSelfie) {
    update.selfie_url = null;
    if (selfiePath) {
      try {
        await supabaseService.storage.from("selfies").remove([selfiePath]);
      } catch { /* best-effort */ }
    }
  }
  await supabaseService.from("profiles").update(update as any).eq("user_id", userId);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "missing auth" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseService = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return jsonResponse({ error: "unauthenticated" }, 401);
    }

    // Look up the user's selfie path + profile photo.
    const { data: profile, error: profileErr } = await supabaseService
      .from("profiles")
      .select("avatar_url, selfie_url")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileErr) throw profileErr;
    if (!profile) {
      return jsonResponse({ error: "profile not found" }, 404);
    }

    const avatarUrlRaw = (profile as any).avatar_url as string | null | undefined;
    const selfiePath = (profile as any).selfie_url as string | null;

    // 1) Validate avatar_url before fetching. Returns status='rejected'
    //    (not a 4xx error) so the client's existing rejection flow shows
    //    the message and the user can fix it.
    const avatarUrl = (typeof avatarUrlRaw === "string" ? avatarUrlRaw.trim() : "") || null;
    if (!avatarUrl) {
      console.log("[rekognition] No avatar_url on profile");
      await writeRejection(supabaseService, user.id, selfiePath, false);
      return jsonResponse({
        status: "rejected",
        message: "Please add a profile photo before verifying your selfie.",
      });
    }

    if (!selfiePath) {
      return jsonResponse({
        error: "MISSING_SELFIE",
        message: "no selfie has been uploaded yet",
      }, 400);
    }

    // 2) Download both images.
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
      return jsonResponse({
        status: "pending_review",
        message: "we're double-checking. we'll get back to you within 24 hours.",
      });
    }

    // Log byte length + first 16 bytes as hex for both images. Lets us see
    // empty files (length 0) and file signatures (HEIC, JPEG, PNG) at a glance.
    console.log("[rekognition] avatar bytes:", avatarBytes.length, "first bytes:", hexPreview(avatarBytes));
    console.log("[rekognition] selfie bytes:", selfieBytes.length, "first bytes:", hexPreview(selfieBytes));

    // Sanity: confirm both are Uint8Array (defensive — Deno/npm shim quirks).
    if (!(avatarBytes instanceof Uint8Array) || !(selfieBytes instanceof Uint8Array)) {
      console.error("[rekognition] image bytes are not Uint8Array — avatar:", typeof avatarBytes, "selfie:", typeof selfieBytes);
      await writeRejection(supabaseService, user.id, selfiePath, true);
      return jsonResponse({
        status: "rejected",
        message: "Couldn't read your photo. Please try again.",
      });
    }

    // 3) Validate image format by magic bytes.
    const avatarFormat = detectImageFormat(avatarBytes);
    const selfieFormat = detectImageFormat(selfieBytes);
    console.log("[rekognition] formats — avatar:", avatarFormat, "selfie:", selfieFormat);

    if (avatarFormat === "empty" || selfieFormat === "empty") {
      console.error("[rekognition] empty image — avatar:", avatarFormat, "selfie:", selfieFormat);
      // Selfie-side fix if selfie is the empty one; avatar-side otherwise.
      await writeRejection(supabaseService, user.id, selfiePath, selfieFormat === "empty");
      return jsonResponse({
        status: "rejected",
        message: "Couldn't read your photo. Please try again.",
      });
    }

    if (avatarFormat === "heic" || selfieFormat === "heic" ||
        (avatarFormat !== "jpeg" && avatarFormat !== "png") ||
        (selfieFormat !== "jpeg" && selfieFormat !== "png")) {
      console.error("[rekognition] unsupported format — avatar:", avatarFormat, "selfie:", selfieFormat);
      const selfieAtFault = selfieFormat !== "jpeg" && selfieFormat !== "png";
      await writeRejection(supabaseService, user.id, selfiePath, selfieAtFault);
      return jsonResponse({
        status: "rejected",
        message: "Image format not supported. Please use a JPEG or PNG photo.",
      });
    }

    // 4) Call Rekognition. DetectFaces preflight on each image first so we
    //    can return a specific error pointing at the broken side instead of
    //    a generic CompareFaces "no match" / InvalidParameterException.
    const rekognition = new RekognitionClient({
      region: Deno.env.get("AWS_REGION") ?? "us-east-1",
      credentials: {
        accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
        secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
      },
    });

    // Preflight: avatar must contain a face.
    try {
      const avatarDetect = await rekognition.send(
        new DetectFacesCommand({ Image: { Bytes: avatarBytes } }),
      );
      console.log(
        "[rekognition] avatar DetectFaces:",
        JSON.stringify({ faceCount: avatarDetect.FaceDetails?.length ?? 0 }),
      );
      if (!avatarDetect.FaceDetails || avatarDetect.FaceDetails.length === 0) {
        await writeRejection(supabaseService, user.id, selfiePath, false);
        return jsonResponse({
          status: "rejected",
          error: "NO_FACE_IN_AVATAR",
          message:
            "We couldn't find a face in your profile photo. Update your profile photo to a clear photo of your face, then try again.",
        });
      }
    } catch (err: any) {
      // If preflight itself throws on the avatar, fall through to CompareFaces;
      // it will surface the same error class. Log so we can see it.
      console.log("[rekognition] avatar DetectFaces error:", err?.name, err?.message);
    }

    // Preflight: selfie must contain a face.
    try {
      const selfieDetect = await rekognition.send(
        new DetectFacesCommand({ Image: { Bytes: selfieBytes } }),
      );
      console.log(
        "[rekognition] selfie DetectFaces:",
        JSON.stringify({ faceCount: selfieDetect.FaceDetails?.length ?? 0 }),
      );
      if (!selfieDetect.FaceDetails || selfieDetect.FaceDetails.length === 0) {
        await writeRejection(supabaseService, user.id, selfiePath, true);
        return jsonResponse({
          status: "rejected",
          error: "NO_FACE_IN_SELFIE",
          message:
            "We couldn't see your face in the selfie. Try again with your face clearly visible and well-lit.",
        });
      }
    } catch (err: any) {
      console.log("[rekognition] selfie DetectFaces error:", err?.name, err?.message);
    }

    let similarity: number | null = null;
    let status: Status = "pending_review";
    let userMessage: string | null = null;

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
      // Log the full AWS error envelope so we can see name + metadata.
      console.log(
        "[rekognition] CompareFaces error:",
        JSON.stringify({
          name: err?.name,
          message: err?.message,
          fault: err?.$fault,
          metadata: err?.$metadata,
        }, null, 2),
      );

      switch (err?.name) {
        case "InvalidParameterException":
        case "InvalidImageFormatException":
          status = "rejected";
          userMessage = "Couldn't process your photos. Please try again with clearer images.";
          break;
        case "ImageTooLargeException":
          status = "rejected";
          userMessage = "Photo is too large. Please try a smaller one.";
          break;
        default:
          // Genuine server / transient issue — queue for human review.
          status = "pending_review";
          break;
      }
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
      userMessage ??
      (status === "approved"
        ? "you're verified."
        : status === "pending_review"
          ? "we're double-checking. we'll get back to you within 24 hours."
          : "your selfie didn't match your profile photo. take another with your face clearly visible.");

    return jsonResponse({ status, similarity, message });
  } catch (err: any) {
    console.error("[rekognition] uncaught error:", err?.message ?? err);
    return jsonResponse({ error: err?.message ?? String(err) }, 500);
  }
});
