import { createFileRoute } from "@tanstack/react-router";
import { verifyBearerCaller } from "@/lib/api-auth.server";
import { parsePublicUrl } from "@/lib/media-link.server";

const MAX_BYTES = 400 * 1024 * 1024;

export const Route = createFileRoute("/api/fetch-audio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await verifyBearerCaller(request))) {
          return Response.json({ error: "Sessão inválida. Volte a iniciar sessão." }, { status: 401 });
        }

        let body: { url?: unknown };
        try {
          body = (await request.json()) as { url?: unknown };
        } catch {
          return Response.json({ error: "Pedido inválido." }, { status: 400 });
        }

        const target = parsePublicUrl(typeof body.url === "string" ? body.url : "");
        if (!target) {
          return Response.json({ error: "Endereço de áudio inválido." }, { status: 400 });
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
