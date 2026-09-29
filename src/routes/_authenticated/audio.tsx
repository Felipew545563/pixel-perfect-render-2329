import { createFileRoute } from "@tanstack/react-router";

import { AudioExtractor } from "@/components/AudioExtractor";

export const Route = createFileRoute("/_authenticated/audio")({
  head: () => ({
    meta: [
      { title: "Extrair áudio — ClipForge Studio" },
      {
        name: "description",
        content:
          "Converta gravações de diretos e vídeos em ficheiros de áudio leves, prontos para a análise automática do ClipForge Studio.",
      },
      { property: "og:title", content: "Extrair áudio — ClipForge Studio" },
      {
        property: "og:description",
        content: "Fique só com o som das suas gravações e acelere a criação de clipes com IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AudioPage,
});

function AudioPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Extrair áudio</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Uma gravação de duas horas em vídeo pode ter vários gigabytes; só o som fica em poucos megabytes.
        </p>
      </header>
      <AudioExtractor />
      <ol className="space-y-2 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        <li>1. Cole a ligação da gravação (Twitch, Kick, YouTube, podcast) ou escolha um ficheiro seu.</li>
        <li>2. Escolha «Leve» se for para gerar clipes, ou «Qualidade alta» para guardar o som.</li>
        <li>3. Clique em «Obter áudio» (ou «Extrair áudio») e descarregue o ficheiro.</li>
        <li>4. Use-o na «Análise automática» da página do vídeo para obter os cortes.</li>

      </ol>
    </div>
  );
}
