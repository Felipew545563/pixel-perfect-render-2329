/**
 * Resolves a public stream/VOD link into a direct audio file URL.
 *
 * Uses a Cobalt-compatible extraction service (self-hostable, no vendor lock-in).
 * Configure with COBALT_API_URL (and optionally COBALT_API_KEY); a small list of
 * public community instances is used as fallback.
 */

const DEFAULT_INSTANCES = [
  "https://co.otomir23.me",
  "https://cobalt-api.kwiatekmiki.com",
  "https://cobalt-backend.canine.tools",
];


const DIRECT_AUDIO = /\.(mp3|m4a|aac|wav|ogg|opus|flac|mp4|m4v|mov|mkv|webm)(\?|$)/i;

export type ResolvedAudio = {
  audioUrl: string;
  filename: string;
  direct: boolean;
  service: string;
  /** True when audioUrl is an HLS media playlist (Twitch/Kick VODs). */
  hls?: boolean;
  durationSeconds?: number | null;
};

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/** Picks the lowest-bandwidth variant (audio_only when present) from a master playlist. */
async function pickLightVariant(masterUrl: string): Promise<{ url: string; durationSeconds: number | null }> {
  const master = await fetch(masterUrl, { headers: { "User-Agent": BROWSER_UA }, signal: AbortSignal.timeout(20_000) });
  if (!master.ok) throw new Error(`playlist ${master.status}`);
  const lines = (await master.text()).split(/\r?\n/);
  let best: { url: string; bw: number; audio: boolean } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("#EXT-X-STREAM-INF")) continue;
    const uri = lines[i + 1]?.trim();
    if (!uri || uri.startsWith("#")) continue;
    const bw = Number(/BANDWIDTH=(\d+)/.exec(line)?.[1] ?? Number.MAX_SAFE_INTEGER);
    const audio = /audio_only/i.test(line) || /audio_only/i.test(uri);
    const url = new URL(uri, masterUrl).toString();
    if (!best || (audio && !best.audio) || (audio === best.audio && bw < best.bw)) best = { url, bw, audio };
  }
  if (!best) throw new Error("sem variantes");
  const media = await fetch(best.url, { headers: { "User-Agent": BROWSER_UA }, signal: AbortSignal.timeout(20_000) });
  const text = media.ok ? await media.text() : "";
  let total = 0;
  for (const m of text.matchAll(/#EXTINF:([\d.]+)/g)) total += Number(m[1]);
  return { url: best.url, durationSeconds: total > 0 ? Math.round(total) : null };
}

async function resolveTwitchVod(id: string): Promise<ResolvedAudio> {
  const gql = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: { "Client-ID": "kimne78kx3ncx6brgo4mv6wki5h1ko", "Content-Type": "application/json" },
    body: JSON.stringify({
      operationName: "PlaybackAccessToken",
      extensions: {
        persistedQuery: { version: 1, sha256Hash: "0828119ded1c13477966434e15800ff57ddacf13ba1911c129dc2200705b0712" },
      },
      variables: { isLive: false, login: "", isVod: true, vodID: id, playerType: "embed" },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await gql.json().catch(() => null)) as
    | { data?: { videoPlaybackAccessToken?: { value: string; signature: string } | null } }
    | null;
  const token = data?.data?.videoPlaybackAccessToken;
  if (!token) throw new Error("gravação não encontrada ou privada");
  const params = new URLSearchParams({
    sig: token.signature,
    token: token.value,
    allow_source: "true",
    allow_audio_only: "true",
    player: "twitchweb",
  });
  const variant = await pickLightVariant(`https://usher.ttvnw.net/vod/${id}.m3u8?${params}`);
  return { audioUrl: variant.url, filename: `twitch-${id}.m4a`, direct: false, service: "Twitch", hls: true, durationSeconds: variant.durationSeconds };
}

async function resolveKickVod(pageUrl: URL, uuid: string): Promise<ResolvedAudio> {
  let master: string | null = null;
  const api = await fetch(`https://kick.com/api/v1/video/${uuid}`, {
    headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (api?.ok) {
    const json = (await api.json().catch(() => null)) as { source?: string } | null;
    if (json?.source) master = json.source;
  }
  if (!master) {
    const page = await fetch(pageUrl.toString(), { headers: { "User-Agent": BROWSER_UA }, signal: AbortSignal.timeout(20_000) });
    const html = page.ok ? await page.text() : "";
    master = /https:\/\/stream\.kick\.com\/[^"'\\\s]+?master\.m3u8/.exec(html)?.[0] ?? null;
  }
  if (!master) throw new Error("gravação não encontrada");
  const variant = await pickLightVariant(master);
  return { audioUrl: variant.url, filename: `kick-${uuid.slice(0, 8)}.m4a`, direct: false, service: "Kick", hls: true, durationSeconds: variant.durationSeconds };
}

/** Blocks non-http(s) schemes and obvious internal/private targets (SSRF guard). */
export function parsePublicUrl(raw: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.startsWith("[")
  ) {
    return null;
  }
  return parsed;
}

function instances(): string[] {
  const configured = process.env["COBALT_API_URL"];
  const list = configured
    ? configured
        .split(",")
        .map((entry) => entry.trim().replace(/\/$/, ""))
        .filter(Boolean)
    : [];
  return [...list, ...DEFAULT_INSTANCES];
}

function filenameFrom(url: URL, fallback: string): string {
  const last = url.pathname.split("/").filter(Boolean).pop();
  if (last && /\.[a-z0-9]{2,5}$/i.test(last)) return decodeURIComponent(last);
  return fallback;
}

export async function resolveAudioLink(input: string): Promise<ResolvedAudio> {
  const target = parsePublicUrl(input);
  if (!target) {
    throw new Error("Essa ligação não é válida. Cole o endereço completo da transmissão ou do ficheiro.");
  }

  // A plain media file can be fetched straight away.
  if (DIRECT_AUDIO.test(target.pathname)) {
    return {
      audioUrl: target.toString(),
      filename: filenameFrom(target, "audio.mp3"),
      direct: true,
      service: "ligação direta",
    };
  }

  const errors: string[] = [];
  const host = target.hostname.replace(/^www\.|^m\./, "");
  try {
    const twitch = host === "twitch.tv" ? /\/videos\/(\d+)/.exec(target.pathname) : null;
    if (twitch) return await resolveTwitchVod(twitch[1]);
    const kick = host === "kick.com" ? /\/videos\/([0-9a-f-]{36})/i.exec(target.pathname) : null;
    if (kick) return await resolveKickVod(target, kick[1]);
  } catch (error) {
    errors.push(`${host}: ${error instanceof Error ? error.message : "falhou"}`);
  }

  const apiKey = process.env["COBALT_API_KEY"];

  for (const base of instances()) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (apiKey) headers["Authorization"] = `Api-Key ${apiKey}`;

      const response = await fetch(`${base}/`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          url: target.toString(),
          downloadMode: "audio",
          audioFormat: "mp3",
          filenameStyle: "basic",
          youtubeHLS: true,
        }),
        signal: AbortSignal.timeout(25_000),
      });

      const payload = (await response.json().catch(() => null)) as
        | { status?: string; url?: string; filename?: string; error?: { code?: string } }
        | null;

      if (!payload) {
        errors.push(`${base}: resposta inválida`);
        continue;
      }

      if ((payload.status === "tunnel" || payload.status === "redirect") && payload.url) {
        const resolved = parsePublicUrl(payload.url);
        if (!resolved) {
          errors.push(`${base}: endereço recusado`);
          continue;
        }
        return {
          audioUrl: resolved.toString(),
          filename: payload.filename || filenameFrom(target, "audio.mp3"),
          direct: false,
          service: base.replace(/^https?:\/\//, ""),
        };
      }

      errors.push(`${base}: ${payload.error?.code ?? payload.status ?? response.status}`);
    } catch (error) {
      errors.push(`${base}: ${error instanceof Error ? error.message : "falhou"}`);
    }
  }

  throw new Error(
    `Não foi possível obter o áudio desta ligação. A plataforma pode estar a bloquear transferências ou a gravação já não está disponível. (${errors
      .slice(0, 3)
      .join(" · ")})`,
  );
}
