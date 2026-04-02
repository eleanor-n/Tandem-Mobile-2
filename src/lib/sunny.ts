import { supabase } from "./supabase";

export type SunnyContext =
  | "imIn"
  | "emptyDiscover"
  | "emptyNotifications"
  | "emptyScrapbook"
  | "emptyMessages"
  | "onboarding"
  | "requestReceived"
  | "requestAccepted"
  | "tandemComplete"
  | "mapEmpty"
  | "profileIncomplete"
  | "firstLogin"
  | "editProfile"
  | "profileView"
  | "postCreated"
  | "subscribeSuccess";

export interface SunnyOptions {
  context: SunnyContext;
  activityTitle?: string;
  hostName?: string;
  partnerName?: string;
  userName?: string;
  stepKey?: string;
}

const FALLBACKS: Record<SunnyContext, string> = {
  imIn: "they'll see you want to join. fingers crossed they're down.",
  emptyDiscover: "nothing nearby right now. check back soon or post your own.",
  emptyNotifications: "all quiet. sunny will let you know when something happens.",
  emptyScrapbook: "join an activity and sunny will save the memory here.",
  emptyMessages: "conversations start here when you connect on an activity.",
  onboarding: "tell me about yourself.",
  requestReceived: "someone wants to join you. take a look.",
  requestAccepted: "you're in. now go make it a good one.",
  tandemComplete: "that one's worth saving.",
  mapEmpty: "nothing pinned nearby yet. try zooming out or posting your own.",
  profileIncomplete: "your profile has room to grow. a little more goes a long way.",
  firstLogin: "welcome. let's find you some good company.",
  editProfile: "looking good. keep it honest and people will find you.",
  profileView: "curious about them? send a request and find out.",
  postCreated: "posted. now someone out there is going to see it.",
  subscribeSuccess: "you're in. let's make it worth it.",
};

const cache = new Map<string, string>();

/**
 * Ask Sunny for a warm, on-brand micro-copy string.
 * Falls back to a hardcoded string if the edge function is unreachable.
 */
export async function getSunnyResponse(opts: SunnyOptions): Promise<string> {
  const cacheKey = opts.stepKey
    ? `${opts.context}:${opts.stepKey}`
    : `${opts.context}:${opts.activityTitle ?? ""}:${opts.partnerName ?? ""}:${opts.userName ?? ""}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;
  try {
    const { data, error } = await supabase.functions.invoke("sunny", {
      body: opts,
    });
    if (error || !data?.text) throw new Error(error?.message ?? "no text");
    const text = (data.text as string).replace(/✦/g, "").trim();
    cache.set(cacheKey, text);
    return text;
  } catch (err) {
    return FALLBACKS[opts.context];
  }
}
