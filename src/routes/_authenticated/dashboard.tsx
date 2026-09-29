import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getOverview } from "@/lib/studio.functions";
import { Badge } from "@/components/ui/badge";
import { ImportLinkForm } from "@/components/ImportLinkForm";
import { formatDuration, formatTimecode, SOURCE_LABELS, VIDEO_STATUS_LABELS } from "@/lib/sources";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel · ClipForge Studio" },
      { name: "description", content: "Os seus vídeos, clipes e utilização de processamento num só lugar." },
      { property: "og:title", content: "Painel · ClipForge Studio" },
      { property: "og:description", content: "Os seus vídeos, clipes e utilização de processamento num só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Painel,
});

function Painel() {
  const fetchOverview = useServerFn(getOverview);
  const { data, isLoading, error } = useQuery({ queryKey: ["overview"], queryFn: () => fetchOverview({}) });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Painel</h1>
          <p className="text-sm text-muted-foreground">Tudo o que processou até ao momento.</p>
        </div>
        <Button asChild size="lg">
          <Link to="/create">
            <Plus className="mr-1 size-4" /> Criar clipes
          </Link>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {isLoading && <p className="text-sm text-muted-foreground">A carregar…</p>}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Vídeos processados", data.totals.videos],
              ["Clipes criados", data.totals.clips],
              ["Clipes este mês", data.totals.clipsThisMonth],
              ["Minutos restantes", data.profile?.credits_minutes ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{value as number}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-medium">Vídeos recentes</h2>
                <Link to="/videos" className="text-sm text-primary underline-offset-4 hover:underline">
                  Ver tudo
                </Link>
              </div>
              {data.recentVideos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ainda não foi importado nenhum vídeo.</p>
              ) : (
                <ul className="space-y-2">
                  {data.recentVideos.map((video) => (
                    <li key={video.id} className="flex items-center justify-between gap-3">
                      <Link
                        to="/videos/$videoId"
                        params={{ videoId: video.id }}
                        className="min-w-0 truncate text-sm hover:underline"
                      >
                        {video.title}
                      </Link>
                      <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        <span>{SOURCE_LABELS[video.source as keyof typeof SOURCE_LABELS] ?? video.source}</span>
                        <span>{formatDuration(video.duration_seconds)}</span>
                        <Badge variant="secondary">
                          {VIDEO_STATUS_LABELS[video.status] ?? video.status}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-medium">Clipes mais recentes</h2>
                <Link to="/clips" className="text-sm text-primary underline-offset-4 hover:underline">
                  Ver tudo
                </Link>
              </div>
              {data.recentClips.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ainda não existem clipes.</p>
              ) : (
                <ul className="space-y-2">
                  {data.recentClips.map((clip) => (
                    <li key={clip.id} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm">{clip.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatTimecode(Number(clip.start_seconds))} · pontuação {clip.clip_score ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
