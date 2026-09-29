/**
 * Resolves a public stream/VOD link into a direct audio file URL.
 *
 * Uses a Cobalt-compatible extraction service (self-hostable, no vendor lock-in).
 * Configure with COBALT_API_URL (and optionally COBALT_API_KEY); a small list of
 * public community instances is used as fallback.
 */

const DEFAULT_INSTANCES = [
  "https://cobalt-api.kwiatekmiki.com",
  "https://cobalt-backend.canine.tools",
  "https://co.otomir23.me",
];

const DIRECT_AUDIO = /\.(mp3|m4a|aac|wav|ogg|opus|flac|mp4|m4v|mov|mkv|webm)(\?|$)/i;

export type ResolvedAudio = {
  audioUrl: string;
  filename: string;
  direct: boolean;
  service: string;
};

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

  const apiKey = process.env["COBALT_API_KEY"];
  const errors: string[] = [];

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
