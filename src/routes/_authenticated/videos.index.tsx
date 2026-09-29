import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { listVideos } from "@/lib/studio.functions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SOURCE_LABELS, VIDEO_STATUS_LABELS, formatDuration } from "@/lib/sources";

export const Route = createFileRoute("/_authenticated/videos/")({
  head: () => ({
    meta: [
      { title: "Vídeos · ClipForge Studio" },
      { name: "description", content: "Todos os vídeos longos que importou, com o respetivo estado de processamento." },
      { property: "og:title", content: "Vídeos · ClipForge Studio" },
      { property: "og:description", content: "Todos os vídeos longos que importou, com o respetivo estado de processamento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VideosPage,
});

function VideosPage() {
  const fetchVideos = useServerFn(listVideos);
  const { data, isLoading } = useQuery({ queryKey: ["videos"], queryFn: () => fetchVideos({}) });
  const [term, setTerm] = useState("");

  const videos = (data ?? []).filter((video) => {
    const q = term.trim().toLowerCase();
    if (!q) return true;
    return (
      video.title.toLowerCase().includes(q) ||
      video.url.toLowerCase().includes(q) ||
      (video.transcript ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vídeos</h1>
          <p className="text-sm text-muted-foreground">Pesquise por título, ligação ou palavras da transcrição.</p>
        </div>
        <Button asChild>
          <Link to="/create">Importar vídeo</Link>
        </Button>
      </div>

      <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Pesquisar vídeos e transcrições…" />

      {isLoading && <p className="text-sm text-muted-foreground">A carregar…</p>}
      {!isLoading && videos.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum vídeo corresponde à sua pesquisa.</p>
      )}

      <ul className="grid gap-3">
        {videos.map((video) => (
          <li key={video.id}>
            <Link
              to="/videos/$videoId"
              params={{ videoId: video.id }}
              className="flex gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/50"
            >
              {video.thumbnail_url ? (
                <img src={video.thumbnail_url} alt="" className="h-16 w-28 shrink-0 rounded object-cover" loading="lazy" />
              ) : (
                <div className="h-16 w-28 shrink-0 rounded bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{video.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{SOURCE_LABELS[video.source as keyof typeof SOURCE_LABELS] ?? video.source}</span>
                  <span>{formatDuration(video.duration_seconds)}</span>
                  <Badge variant="secondary">{VIDEO_STATUS_LABELS[video.status] ?? video.status}</Badge>
                </div>
                {video.error_message && (
                  <p className="mt-1 truncate text-xs text-destructive">{video.error_message}</p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
