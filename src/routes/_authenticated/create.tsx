import { createFileRoute } from "@tanstack/react-router";

import { ImportLinkForm } from "@/components/ImportLinkForm";

export const Route = createFileRoute("/_authenticated/create")({
  head: () => ({
    meta: [
      { title: "Criar clipes · ClipForge Studio" },
      { name: "description", content: "Cole a ligação de um vídeo e deixe a IA encontrar os melhores momentos para clipes curtos." },
      { property: "og:title", content: "Criar clipes · ClipForge Studio" },
      { property: "og:description", content: "Cole a ligação de um vídeo e deixe a IA encontrar os melhores momentos para clipes curtos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreatePage,
});

function CreatePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Criar clipes</h1>
        <p className="text-sm text-muted-foreground">
          Cole a ligação de uma transmissão em direto, podcast, entrevista ou qualquer vídeo longo.
        </p>
      </div>

      <ImportLinkForm />
    </div>
  );
}
