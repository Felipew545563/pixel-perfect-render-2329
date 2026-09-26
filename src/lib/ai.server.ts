const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

export type ClipCandidate = {
  title: string;
  hook: string;
  description: string;
  start_seconds: number;
  end_seconds: number;
  clip_score: number;
  hook_score: number;
  emotion_score: number;
  clarity_score: number;
  reasoning: string;
  transcript_excerpt: string;
  hashtags: string[];
  caption_tiktok: string;
  caption_instagram: string;
  youtube_title: string;
};

type GatewayError = Error & { status?: number };

function gatewayError(message: string, status: number): GatewayError {
  const error: GatewayError = new Error(message);
  error.status = status;
  return error;
}

/** Streams a Responses call and returns the accumulated text. */
async function runModel(instructions: string, prompt: string, signal?: AbortSignal): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw gatewayError("AI is not configured for this app.", 401);

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    signal: signal ?? null,
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      store: false,
      reasoning: { effort: "medium", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      input: [
        { role: "system", content: [{ type: "input_text", text: instructions }] },
        { role: "user", content: [{ type: "input_text", text: prompt }] },
      ],
    }),
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    if (response.status === 429)
      throw gatewayError("The AI is busy right now. Try again in a moment.", 429);
    if (response.status === 402)
      throw gatewayError("AI credits are exhausted for this workspace.", 402);
    throw gatewayError(
      `AI request failed (${response.status}). ${detail.slice(0, 300)}`,
      response.status,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const event = JSON.parse(payload) as {
            type?: string;
            delta?: string;
            text?: string;
            response?: { output_text?: string };
          };
          if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
            text += event.delta;
          } else if (event.type === "response.output_text.done" && !text && event.text) {
            text += event.text;
          } else if (event.type === "error") {
            throw gatewayError("The AI returned an error while analyzing the video.", 502);
          }
        } catch {
          // ignore partial / non-JSON frames
        }
      }
    }
  }

  return text.trim();
}

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced?.[1] ?? raw).trim();
  const start = body.search(/[[{]/);
  if (start === -1) throw new Error("The AI response did not contain any clip data.");
  const candidate = body.slice(start);
  try {
    return JSON.parse(candidate);
  } catch {
    const lastBrace = Math.max(candidate.lastIndexOf("]"), candidate.lastIndexOf("}"));
    return JSON.parse(candidate.slice(0, lastBrace + 1));
  }
}

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const str = (value: unknown, fallback = "") =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

export type FindClipsOptions = {
  transcript: string;
  videoTitle: string;
  durationSeconds: number | null;
  clipCount: number;
  lengthPreset: "short" | "medium" | "long" | "auto";
  language: string;
};

const LENGTH_HINTS: Record<FindClipsOptions["lengthPreset"], string> = {
  short: "Each clip must last 15-30 seconds.",
  medium: "Each clip must last 30-60 seconds.",
  long: "Each clip must last 60-180 seconds.",
  auto: "Choose the ideal length per clip, between 15 and 180 seconds.",
};

export async function findClips(
  options: FindClipsOptions,
  signal?: AbortSignal,
): Promise<ClipCandidate[]> {
  const instructions = [
    "You are an expert short-form video editor who finds the strongest standalone moments in long recordings.",
    "You receive a transcript and must return the best self-contained segments for TikTok, Reels and Shorts.",
    "Each segment must follow HOOK -> DEVELOPMENT -> PAYOFF, start and end on a natural sentence boundary, and never cut mid-sentence.",
    "Avoid silence, filler and segments that need missing context.",
    LENGTH_HINTS[options.lengthPreset],
    "Scores are internal quality estimates from 0 to 100, never a guarantee of virality.",
    `Write all generated text in ${options.language}.`,
    "Return ONLY a JSON array, no prose, no markdown fences. Each item has exactly these keys:",
    '"title", "hook", "description", "start_seconds", "end_seconds", "clip_score", "hook_score", "emotion_score", "clarity_score", "reasoning", "transcript_excerpt", "hashtags" (array of strings without #), "caption_tiktok", "caption_instagram", "youtube_title".',
    "Timestamps are seconds from the start of the video. If the transcript has timecodes, use them; otherwise estimate from reading pace (~150 words per minute).",
    "Order the array by clip_score, best first.",
  ].join("\n");

  const prompt = [
    `Video title: ${options.videoTitle}`,
    options.durationSeconds ? `Video duration: ${options.durationSeconds} seconds` : "Video duration: unknown",
    `Number of clips to return: ${options.clipCount}`,
    "",
    "TRANSCRIPT:",
    options.transcript.slice(0, 120_000),
  ].join("\n");

  const raw = await runModel(instructions, prompt, signal);
  const parsed = extractJson(raw);
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { clips?: unknown[] })?.clips)
      ? (parsed as { clips: unknown[] }).clips
      : [];

  if (!list.length) throw new Error("The AI did not find any usable moments in this transcript.");

  const maxEnd = options.durationSeconds ?? Number.MAX_SAFE_INTEGER;

  return list.slice(0, options.clipCount).map((item) => {
    const raw = (item ?? {}) as Record<string, unknown>;
    const start = clamp(raw["start_seconds"], 0, maxEnd, 0);
    const end = clamp(raw["end_seconds"], start + 5, maxEnd, start + 45);
    const hashtags = Array.isArray(raw["hashtags"])
      ? (raw["hashtags"] as unknown[])
          .map((tag) => str(tag).replace(/^#/, ""))
          .filter(Boolean)
          .slice(0, 12)
      : [];
    return {
      title: str(raw["title"], "Untitled clip").slice(0, 160),
      hook: str(raw["hook"]).slice(0, 300),
      description: str(raw["description"]).slice(0, 1200),
      start_seconds: start,
      end_seconds: end,
      clip_score: Math.round(clamp(raw["clip_score"], 0, 100, 50)),
      hook_score: Math.round(clamp(raw["hook_score"], 0, 100, 50)),
      emotion_score: Math.round(clamp(raw["emotion_score"], 0, 100, 50)),
      clarity_score: Math.round(clamp(raw["clarity_score"], 0, 100, 50)),
      reasoning: str(raw["reasoning"]).slice(0, 1200),
      transcript_excerpt: str(raw["transcript_excerpt"]).slice(0, 4000),
      hashtags,
      caption_tiktok: str(raw["caption_tiktok"]).slice(0, 600),
      caption_instagram: str(raw["caption_instagram"]).slice(0, 1200),
      youtube_title: str(raw["youtube_title"]).slice(0, 200),
    };
  });
}
