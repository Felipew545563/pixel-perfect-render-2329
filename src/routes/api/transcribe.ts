import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/audio/transcriptions";
const MODEL = "google/gemini-3.5-transcribe";
const MAX_BYTES = 12 * 1024 * 1024;

async function verifyCaller(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  if (token.split(".").length !== 3) return false;

  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return false;

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  return !error && Boolean(data?.claims?.sub);
}

/** Reads the gateway's SSE transcript stream and returns the final text. */
async function readTranscript(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let delta = "";
  let final = "";

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
          const event = JSON.parse(payload) as { type?: string; delta?: string; text?: string };
          if (event.type === "transcript.text.delta" && typeof event.delta === "string") delta += event.delta;
          else if (event.type === "transcript.text.done" && typeof event.text === "string") final = event.text;
        } catch {
          // ignore partial frames
        }
      }
    }
  }
  return (final || delta).trim();
}

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await verifyCaller(request))) {
          return Response.json({ error: "Sessão inválida. Volte a iniciar sessão." }, { status: 401 });
        }

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return Response.json({ error: "A IA não está configurada nesta aplicação." }, { status: 500 });
        }

        const declared = Number(request.headers.get("content-length") ?? 0);
        if (declared > MAX_BYTES) {
          return Response.json({ error: "Este trecho de áudio é demasiado grande." }, { status: 413 });
        }

        let incoming: FormData;
        try {
          incoming = await request.formData();
        } catch {
          return Response.json({ error: "Pedido de áudio inválido." }, { status: 400 });
        }

        const file = incoming.get("file");
        if (!(file instanceof File) || file.size === 0) {
          return Response.json({ error: "Não foi recebido áudio para transcrever." }, { status: 400 });
        }
        if (file.size > MAX_BYTES) {
          return Response.json({ error: "Este trecho de áudio é demasiado grande." }, { status: 413 });
        }

        const language = incoming.get("language");

        const body = new FormData();
        body.append("file", file, file.name || "audio.m4a");
        body.append("model", MODEL);
        body.append("stream", "true");
        if (typeof language === "string" && language.trim()) body.append("language", language.trim());

        const upstream = await fetch(GATEWAY_URL, {
          method: "POST",
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
          body,
        });

        if (!upstream.ok) {
          const detail = await upstream.text().catch(() => "");
          const message =
            upstream.status === 429
              ? "O serviço de transcrição está ocupado. Tente novamente dentro de instantes."
              : upstream.status === 402
                ? "Os créditos de IA deste espaço de trabalho esgotaram-se."
                : `Falha na transcrição (${upstream.status}). ${detail.slice(0, 300)}`;
          return Response.json({ error: message }, { status: upstream.status });
        }

        const text = await readTranscript(upstream);
        return Response.json({ text });
      },
    },
  },
});
