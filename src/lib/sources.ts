export type VideoSource = "youtube" | "twitch" | "vimeo" | "other";

export type DetectedSource = {
  source: VideoSource;
  sourceId: string | null;
  normalizedUrl: string;
};

export function detectSource(rawUrl: string): DetectedSource | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol)) return null;
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0] || null;
    return { source: "youtube", sourceId: id, normalizedUrl: url.toString() };
  }
  if (host.endsWith("youtube.com")) {
    const id =
      url.searchParams.get("v") ||
      url.pathname.match(/\/(?:shorts|live|embed)\/([\w-]+)/)?.[1] ||
      null;
    return { source: "youtube", sourceId: id, normalizedUrl: url.toString() };
  }
  if (host.endsWith("twitch.tv")) {
    const id = url.pathname.match(/\/videos\/(\d+)/)?.[1] ?? null;
    return { source: "twitch", sourceId: id, normalizedUrl: url.toString() };
  }
  if (host.endsWith("vimeo.com")) {
    const id = url.pathname.match(/\/(\d+)/)?.[1] ?? null;
    return { source: "vimeo", sourceId: id, normalizedUrl: url.toString() };
  }
  return { source: "other", sourceId: null, normalizedUrl: url.toString() };
}

export const SOURCE_LABELS: Record<VideoSource, string> = {
  youtube: "YouTube",
  twitch: "Twitch",
  vimeo: "Vimeo",
  other: "Outra ligação",
};

export const VIDEO_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  awaiting_transcript: "Requer transcrição",
  analyzing: "Em análise",
  completed: "Concluído",
  failed: "Falhou",
};

export function formatTimecode(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "—";
  return formatTimecode(seconds);
}

/** Embed URL that plays only the clip segment, when the platform supports it. */
export function clipEmbedUrl(
  source: string,
  sourceId: string | null,
  url: string,
  start: number,
  end: number,
): string | null {
  const s = Math.max(0, Math.floor(start));
  const e = Math.max(s + 1, Math.ceil(end));
  if (source === "youtube" && sourceId) {
    return `https://www.youtube.com/embed/${sourceId}?start=${s}&end=${e}&rel=0&modestbranding=1`;
  }
  if (source === "vimeo" && sourceId) {
    return `https://player.vimeo.com/video/${sourceId}#t=${s}s`;
  }
  if (source === "twitch" && sourceId) {
    const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
    return `https://player.twitch.tv/?video=${sourceId}&time=${Math.floor(s / 60)}m${s % 60}s&parent=${host}&autoplay=false`;
  }
  return url ? null : null;
}
