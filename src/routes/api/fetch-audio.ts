import { createFileRoute } from "@tanstack/react-router";
import { verifyBearerCaller } from "@/lib/api-auth.server";
import { parsePublicUrl } from "@/lib/media-link.server";

const MAX_BYTES = 400 * 1024 * 1024;
const MAX_HLS_SECONDS = 3 * 60 * 60;
const UA =
  "ClipForgeStudio/1.0";

/** Concatenates the MPEG-TS segments of an HLS media playlist for a time window into one stream. */
async function streamHlsSegments(playlistUrl: string, start: number, length: number): Promise<Response> {
  const res = await fetch(playlistUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) }).catch(
    () => null,
  );
  if (!res?.ok) {
    return Response.json({ error: "Não foi possível ler a gravação. Tente novamente." }, { status: 502 });
  }
  const lines = (await res.text()).split(/\r?\n/);
  const segments: string[] = [];
  let clock = 0;
  let pending = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("#EXTINF:")) {
      pending = Number(line.slice(8).split(",")[0]) || 0;
    } else if (line && !line.startsWith("#")) {
      const segStart = clock;
      clock += pending;
      if (clock > start && segStart < start + length) {
        const parsed = parsePublicUrl(new URL(line, playlistUrl).toString());
        if (parsed) segments.push(parsed.toString());
      }
    }
  }
  if (segments.length === 0) {
    return Response.json({ error: "Esse intervalo não existe nesta gravação." }, { status: 422 });
  }

  let index = 0;
  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (index >= segments.length || sent > MAX_BYTES) {
        controller.close();
        return;
      }
      const url = segments[index++];
      for (let attempt = 0; attempt < 3; attempt++) {
        const seg = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) }).catch(
          () => null,
        );
        if (seg?.ok) {
          const chunk = new Uint8Array(await seg.arrayBuffer());
          sent += chunk.byteLength;
          controller.enqueue(chunk);
          return;
        }
      }
      // Skip a segment that keeps failing rather than aborting the whole download.
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "video/mp2t", "Cache-Control": "no-store", "X-Segments": String(segments.length) },
  });
}

export const Route = createFileRoute("/api/fetch-audio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await verifyBearerCaller(request))) {
          return Response.json({ error: "Sessão inválida. Volte a iniciar sessão." }, { status: 401 });
        }

        let body: { url?: unknown; hls?: unknown; startSeconds?: unknown; durationSeconds?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Pedido inválido." }, { status: 400 });
        }

        const target = parsePublicUrl(typeof body.url === "string" ? body.url : "");
        if (!target) {
          return Response.json({ error: "Endereço de áudio inválido." }, { status: 400 });
        }

        if (body.hls === true) {
          const start = Math.max(0, Number(body.startSeconds) || 0);
          const length = Math.min(MAX_HLS_SECONDS, Math.max(60, Number(body.durationSeconds) || MAX_HLS_SECONDS));
          return streamHlsSegments(target.toString(), start, length);
        }

        const upstream = await fetch(target.toString(), {
          headers: { "User-Agent": "ClipForgeStudio/1.0" },
          signal: AbortSignal.timeout(120_000),
        }).catch(() => null);

        if (!upstream?.ok || !upstream.body) {
          return Response.json(
            { error: "A transferência do áudio falhou. Tente novamente ou use a opção por ficheiro." },
            { status: 502 },
          );
        }

        const declared = Number(upstream.headers.get("content-length") ?? 0);
        if (declared > MAX_BYTES) {
          return Response.json(
            { error: "Este áudio é demasiado grande. Descarregue apenas uma parte da gravação." },
            { status: 413 },
          );
        }

        const headers = new Headers();
        headers.set("Content-Type", upstream.headers.get("content-type") ?? "audio/mpeg");
        if (declared) headers.set("Content-Length", String(declared));
        headers.set("Cache-Control", "no-store");

        return new Response(upstream.body, { status: 200, headers });
      },
    },
  },
});
