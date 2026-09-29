import { createFileRoute } from "@tanstack/react-router";
import { verifyBearerCaller } from "@/lib/api-auth.server";
import { resolveAudioLink } from "@/lib/media-link.server";

export const Route = createFileRoute("/api/resolve-audio")({
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

        const url = typeof body.url === "string" ? body.url.trim() : "";
        if (!url || url.length > 2048) {
          return Response.json({ error: "Cole a ligação da transmissão ou gravação." }, { status: 400 });
        }

        try {
          const resolved = await resolveAudioLink(url);
          return Response.json(resolved);
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Não foi possível obter o áudio." },
            { status: 422 },
          );
        }
      },
    },
  },
});
