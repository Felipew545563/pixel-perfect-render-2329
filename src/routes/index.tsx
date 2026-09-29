import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Scissors, Wand2, Captions, Crop } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ClipForge Studio · Clipes com IA a partir de vídeos longos" },
      {
        name: "description",
        content:
          "Cole a ligação de um podcast, transmissão em direto ou entrevista e deixe a IA encontrar os melhores momentos para TikTok, Reels e Shorts.",
      },
      { property: "og:title", content: "ClipForge Studio · Clipes com IA a partir de vídeos longos" },
      {
        property: "og:description",
        content: "A IA encontra os melhores momentos dos seus vídeos longos e transforma-os em clipes curtos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Wand2, title: "Deteção de momentos com IA", text: "Gancho, desenvolvimento e conclusão avaliados em cada clipe sugerido." },
  { icon: Captions, title: "Textos prontos a publicar", text: "Títulos, ganchos, descrições, legendas e hashtags para cada clipe." },
  { icon: Crop, title: "Pensado para vídeo vertical", text: "Cada clipe é preparado em 9:16, com opções 1:1 e 16:9." },
];

function Landing() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  // Quem já tem sessão (incluindo quem regressa da Apple ou do Google) entra
  // diretamente no espaço de trabalho, em vez de ver a página pública.
  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  const signedIn = !loading && !!session;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6">
        <div className="flex items-center gap-2">
          <Scissors className="size-5 text-primary" />
          <span className="font-semibold tracking-tight">ClipForge Studio</span>
        </div>
        <Button asChild size="sm">
          {signedIn ? (
            <Link to="/dashboard">Abrir espaço de trabalho</Link>
          ) : (
            <Link to="/auth">Iniciar sessão</Link>
          )}
        </Button>
      </header>

      <section className="mx-auto max-w-3xl px-4 pb-12 pt-10 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Transforme vídeos longos em clipes curtos com IA
        </h1>
        <p className="mt-4 text-base text-muted-foreground sm:text-lg">
          Cole a ligação de um podcast, transmissão em direto ou entrevista. A IA lê a transcrição, encontra os melhores
          momentos e escreve o título, o gancho e as legendas de cada clipe.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            {signedIn ? (
              <Link to="/dashboard">Abrir espaço de trabalho</Link>
            ) : (
              <Link to="/auth">Começar</Link>
            )}
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-16 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="rounded-lg border border-border bg-card p-5">
            <feature.icon className="size-5 text-primary" />
            <h2 className="mt-3 font-medium">{feature.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{feature.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
