import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { detectSource } from "./sources";
import { findClips } from "./ai.server";

/* ------------------------------------------------------------------ */
/* Metadata lookup (oEmbed — no API key needed)                       */
/* ------------------------------------------------------------------ */

type Metadata = {
  title: string;
  thumbnailUrl: string | null;
  author: string | null;
  durationSeconds: number | null;
};

async function lookupMetadata(
  source: string,
  url: string,
  sourceId: string | null,
): Promise<Metadata> {
  const fallback: Metadata = {
    title: sourceId ? `${source} · ${sourceId}` : "Imported video",
    thumbnailUrl: null,
    author: null,
    durationSeconds: null,
  };
  try {
    let endpoint: string | null = null;
    if (source === "youtube") {
      endpoint = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
    } else if (source === "vimeo") {
      endpoint = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
    }
    if (!endpoint) return fallback;
    const response = await fetch(endpoint, { headers: { accept: "application/json" } });
    if (!response.ok) return fallback;
    const data = (await response.json()) as {
      title?: string;
      thumbnail_url?: string;
      author_name?: string;
      duration?: number;
    };
    return {
      title: data.title?.trim() || fallback.title,
      thumbnailUrl: data.thumbnail_url ?? null,
      author: data.author_name ?? null,
      durationSeconds: typeof data.duration === "number" ? Math.round(data.duration) : null,
    };
  } catch {
    return fallback;
  }
}

/* ------------------------------------------------------------------ */
/* Profile + dashboard                                                */
/* ------------------------------------------------------------------ */

export const getOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [profileRes, videosRes, clipsRes, projectsRes, usageRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("videos")
        .select("id, title, source, status, thumbnail_url, duration_seconds, created_at")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("clips")
        .select("id, video_id, title, hook, clip_score, start_seconds, end_seconds, created_at")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase.from("projects").select("id, name, created_at").order("created_at", { ascending: false }).limit(5),
      supabase.from("usage_events").select("minutes_used, created_at").order("created_at", { ascending: false }).limit(50),
    ]);

    const [videoCount, clipCount] = await Promise.all([
      supabase.from("videos").select("id", { count: "exact", head: true }),
      supabase.from("clips").select("id", { count: "exact", head: true }),
    ]);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const clipsThisMonth = await supabase
      .from("clips")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthStart.toISOString());

    const minutesUsed = (usageRes.data ?? []).reduce((sum, row) => sum + (row.minutes_used ?? 0), 0);

    return {
      profile: profileRes.data,
      totals: {
        videos: videoCount.count ?? 0,
        clips: clipCount.count ?? 0,
        clipsThisMonth: clipsThisMonth.count ?? 0,
        minutesUsed,
      },
      recentVideos: videosRes.data ?? [],
      recentClips: clipsRes.data ?? [],
      recentProjects: projectsRes.data ?? [],
    };
  });

/* ------------------------------------------------------------------ */
/* Projects                                                           */
/* ------------------------------------------------------------------ */

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().max(500).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("projects")
      .insert({ user_id: context.userId, name: data.name, description: data.description ?? null })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const renameProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(120) }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("projects").update({ name: data.name }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Videos                                                             */
/* ------------------------------------------------------------------ */

export const inspectUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ url: z.string().trim().min(5).max(2000) }).parse(data))
  .handler(async ({ data }) => {
    const detected = detectSource(data.url);
    if (!detected) throw new Error("That link is not a valid URL. Paste a full address starting with https://");
    const meta = await lookupMetadata(detected.source, detected.normalizedUrl, detected.sourceId);
    return { ...detected, ...meta };
  });

export const importVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        url: z.string().trim().min(5).max(2000),
        projectId: z.string().uuid().nullable().optional(),
        transcript: z.string().trim().max(400_000).optional(),
        durationSeconds: z.number().int().min(0).max(60 * 60 * 24).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const detected = detectSource(data.url);
    if (!detected) throw new Error("That link is not a valid URL. Paste a full address starting with https://");

    const meta = await lookupMetadata(detected.source, detected.normalizedUrl, detected.sourceId);
    const transcript = data.transcript?.trim() || null;

    const { data: row, error } = await context.supabase
      .from("videos")
      .insert({
        user_id: context.userId,
        project_id: data.projectId ?? null,
        source: detected.source,
        source_id: detected.sourceId,
        url: detected.normalizedUrl,
        title: meta.title,
        thumbnail_url: meta.thumbnailUrl,
        author: meta.author,
        duration_seconds: data.durationSeconds ?? meta.durationSeconds,
        transcript,
        transcript_source: transcript ? "user" : null,
        status: transcript ? "pending" : "awaiting_transcript",
        error_message: transcript
          ? null
          : "Add the transcript of this video so the AI can find the best moments.",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listVideos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("videos")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const [videoRes, clipsRes] = await Promise.all([
      context.supabase.from("videos").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("clips").select("*").eq("video_id", data.id).order("position", { ascending: true }),
    ]);
    if (videoRes.error) throw new Error(videoRes.error.message);
    if (!videoRes.data) throw new Error("Video not found.");
    return { video: videoRes.data, clips: clipsRes.data ?? [] };
  });

export const updateVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(300).optional(),
        transcript: z.string().max(400_000).optional(),
        durationSeconds: z.number().int().min(0).max(60 * 60 * 24).nullable().optional(),
        projectId: z.string().uuid().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch["title"] = data.title;
    if (data.durationSeconds !== undefined) patch["duration_seconds"] = data.durationSeconds;
    if (data.projectId !== undefined) patch["project_id"] = data.projectId;
    if (data.transcript !== undefined) {
      const transcript = data.transcript.trim();
      patch["transcript"] = transcript || null;
      patch["transcript_source"] = transcript ? "user" : null;
      patch["status"] = transcript ? "pending" : "awaiting_transcript";
      patch["error_message"] = transcript ? null : "Add the transcript so the AI can find the best moments.";
    }
    const { error } = await context.supabase.from("videos").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("videos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* AI analysis                                                        */
/* ------------------------------------------------------------------ */

export const analyzeVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        clipCount: z.number().int().min(1).max(20).default(5),
        lengthPreset: z.enum(["short", "medium", "long", "auto"]).default("auto"),
        language: z.string().trim().min(2).max(40).default("the same language as the transcript"),
        replaceExisting: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: video, error } = await supabase.from("videos").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!video) throw new Error("Video not found.");

    const transcript = video.transcript?.trim();
    if (!transcript || transcript.length < 200) {
      await supabase
        .from("videos")
        .update({
          status: "awaiting_transcript",
          error_message: "The transcript is missing or too short to analyze.",
        })
        .eq("id", video.id);
      throw new Error("Add the full transcript of this video before running the analysis.");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("credits_minutes")
      .eq("id", userId)
      .maybeSingle();

    const estimatedMinutes = Math.max(
      1,
      Math.ceil((video.duration_seconds ?? transcript.split(/\s+/).length / 150 * 60) / 60),
    );
    if ((profile?.credits_minutes ?? 0) < estimatedMinutes) {
      throw new Error(
        `Not enough processing minutes left. This video needs about ${estimatedMinutes} minutes.`,
      );
    }

    await supabase.from("videos").update({ status: "analyzing", error_message: null }).eq("id", video.id);

    try {
      const candidates = await findClips({
        transcript,
        videoTitle: video.title,
        durationSeconds: video.duration_seconds,
        clipCount: data.clipCount,
        lengthPreset: data.lengthPreset,
        language: data.language,
      });

      if (data.replaceExisting) {
        await supabase.from("clips").delete().eq("video_id", video.id);
      }

      const rows = candidates.map((clip, index) => ({
        user_id: userId,
        video_id: video.id,
        position: index + 1,
        title: clip.title,
        hook: clip.hook,
        description: clip.description,
        start_seconds: clip.start_seconds,
        end_seconds: clip.end_seconds,
        clip_score: clip.clip_score,
        hook_score: clip.hook_score,
        emotion_score: clip.emotion_score,
        clarity_score: clip.clarity_score,
        reasoning: clip.reasoning,
        transcript_excerpt: clip.transcript_excerpt,
        hashtags: clip.hashtags,
        caption_tiktok: clip.caption_tiktok,
        caption_instagram: clip.caption_instagram,
        youtube_title: clip.youtube_title,
        status: "ready",
      }));

      const { error: insertError } = await supabase.from("clips").insert(rows);
      if (insertError) throw new Error(insertError.message);

      await supabase.from("videos").update({ status: "completed", error_message: null }).eq("id", video.id);
      await supabase.from("usage_events").insert({
        user_id: userId,
        video_id: video.id,
        kind: "analysis",
        minutes_used: estimatedMinutes,
        note: `${rows.length} clips found`,
      });
      await supabase
        .from("profiles")
        .update({ credits_minutes: Math.max(0, (profile?.credits_minutes ?? 0) - estimatedMinutes) })
        .eq("id", userId);

      return { clips: rows.length, minutesUsed: estimatedMinutes };
    } catch (err) {
      const message = err instanceof Error ? err.message : "The analysis failed.";
      await supabase.from("videos").update({ status: "failed", error_message: message }).eq("id", video.id);
      throw new Error(message);
    }
  });

/* ------------------------------------------------------------------ */
/* Clips                                                              */
/* ------------------------------------------------------------------ */

export const listClips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [clipsRes, videosRes] = await Promise.all([
      context.supabase.from("clips").select("*").order("clip_score", { ascending: false }),
      context.supabase.from("videos").select("id, title, source, source_id, url, thumbnail_url"),
    ]);
    if (clipsRes.error) throw new Error(clipsRes.error.message);
    return { clips: clipsRes.data ?? [], videos: videosRes.data ?? [] };
  });

export const updateClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().trim().max(300).optional(),
        hook: z.string().trim().max(500).optional(),
        description: z.string().trim().max(2000).optional(),
        startSeconds: z.number().min(0).optional(),
        endSeconds: z.number().min(0).optional(),
        captionTiktok: z.string().trim().max(1000).optional(),
        captionInstagram: z.string().trim().max(2000).optional(),
        youtubeTitle: z.string().trim().max(300).optional(),
        hashtags: z.array(z.string().trim().max(60)).max(20).optional(),
        aspectRatio: z.enum(["9:16", "1:1", "16:9"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch["title"] = data.title;
    if (data.hook !== undefined) patch["hook"] = data.hook;
    if (data.description !== undefined) patch["description"] = data.description;
    if (data.startSeconds !== undefined) patch["start_seconds"] = data.startSeconds;
    if (data.endSeconds !== undefined) patch["end_seconds"] = data.endSeconds;
    if (data.captionTiktok !== undefined) patch["caption_tiktok"] = data.captionTiktok;
    if (data.captionInstagram !== undefined) patch["caption_instagram"] = data.captionInstagram;
    if (data.youtubeTitle !== undefined) patch["youtube_title"] = data.youtubeTitle;
    if (data.hashtags !== undefined) patch["hashtags"] = data.hashtags;
    if (data.aspectRatio !== undefined) patch["aspect_ratio"] = data.aspectRatio;

    const { error } = await context.supabase.from("clips").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("clips").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
