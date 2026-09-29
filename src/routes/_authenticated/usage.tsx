import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getOverview } from "@/lib/studio.functions";

export const Route = createFileRoute("/_authenticated/usage")({
  head: () => ({
    meta: [
      { title: "Utilização · ClipForge Studio" },
      { name: "description", content: "Minutos de processamento restantes, clipes gerados e plano atual." },
      { property: "og:title", content: "Utilização · ClipForge Studio" },
      { property: "og:description", content: "Minutos de processamento restantes, clipes gerados e plano atual." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UsagePage,
});

const PLANS = [
  { name: "Gratuito", detail: "120 minutos de processamento e até 5 clipes por vídeo." },
  { name: "Creator", detail: "Mais minutos, até 10 clipes por vídeo e sem marca de água." },
  { name: "Pro", detail: "Deteção avançada, até 20 clipes por vídeo e modelos." },
  { name: "Business", detail: "Limites mais elevados, vários utilizadores e processamento prioritário." },
];

function UsagePage() {
  const fetchOverview = useServerFn(getOverview);
  const { data, isLoading } = useQuery({ queryKey: ["overview"], queryFn: () => fetchOverview({}) });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Utilização e plano</h1>
        <p className="text-sm text-muted-foreground">
          Sem limite de minutos: pode analisar quantos vídeos quiser, com a duração que quiser.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">A carregar…</p>}

      {data && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Minutos disponíveis", "Ilimitado"],
            ["Minutos analisados", String(data.totals.minutesUsed)],
            ["Clipes este mês", String(data.totals.clipsThisMonth)],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="font-medium">Planos</h2>
        <p className="text-sm text-muted-foreground">
          Por enquanto, todos utilizam o plano Gratuito. Os planos pagos e o pagamento ainda não estão disponíveis.
        </p>
        <ul className="grid gap-2">
          {PLANS.map((plan) => (
            <li key={plan.name} className="rounded-lg border border-border bg-card p-3">
              <p className="font-medium">{plan.name}</p>
              <p className="text-sm text-muted-foreground">{plan.detail}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
