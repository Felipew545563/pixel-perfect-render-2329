import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Trash2 } from "lucide-react";

import { analyzeVideo, deleteClip, deleteVideo, getVideo, updateClip, updateVideo } from "@/lib/studio.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipCard, type ClipRow } from "@/components/ClipCard";
import { SOURCE_LABELS, VIDEO_STATUS_LABELS, formatDuration } from "@/lib/sources";

export const Route = createFileRoute("/_authenticated/videos/$videoId")({
  head: () => ({
    meta: [
      { title: "Análise do vídeo · ClipForge Studio" },
      { name: "description", content: "Transcrição, análise com IA e clipes gerados para este vídeo." },
      { property: "og:title", content: "Análise do vídeo · ClipForge Studio" },
      { property: "og:description", content: "Transcrição, análise com IA e clipes gerados para este vídeo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VideoDetail,
});

type SortKey = "score" | "duration" | "position";

function VideoDetail() {
  const { videoId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const fetchVideo = useServerFn(getVideo);
  const runAnalysis = useServerFn(analyzeVideo);
  const saveVideo = useServerFn(updateVideo);
  const removeVideo = useServerFn(deleteVideo);
  const saveClip = useServerFn(updateClip);
  const removeClip = useServerFn(deleteClip);

  const { data, isLoading, error } = useQuery({
    queryKey: ["video", videoId],
    queryFn: () => fetchVideo({ data: { id: videoId } }),
  });

  const [transcript, setTranscrição] = useState("");
  const [clipCount, setClipCount] = useState("5");
  const [lengthPreset, setLengthPreset] = useState<"short" | "medium" | "long" | "auto">("auto");
  const [language, setLanguage] = useState("português de Portugal");
  const [sort, setSort] = useState<SortKey>("score");

  useEffect(() => {
    if (data?.video) setTranscrição(data.video.transcript ?? "");
  }, [data?.video?.id, data?.video?.transcript]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["video", videoId] });
    queryClient.invalidateQueries({ queryKey: ["overview"] });
    queryClient.invalidateQueries({ queryKey: ["clips"] });
    queryClient.invalidateQueries({ queryKey: ["videos"] });
  };

  const transcriptMutation = useMutation({
    mutationFn: () => saveVideo({ data: { id: videoId, transcript } }),
    onSuccess: () => {
      toast.success("Transcrição guardada");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const analysisMutation = useMutation({
    mutationFn: () =>
      runAnalysis({
        data: {
          id: videoId,
          clipCount: Number(clipCount),
          lengthPreset,
          language,
          replaceExisting: true,
        },
      }),
    onSuccess: (result) => {
      toast.success(`${(result as { clipes: number }).clips} clipes gerados`);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const clipSaveMutation = useMutation({
    mutationFn: (patch: Parameters<typeof saveClip>[0] extends never ? never : Record<string, unknown>) =>
      saveClip({ data: patch as never }),
    onSuccess: () => {
      toast.success("Clipe atualizado");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const clipDeleteMutation = useMutation({
    mutationFn: (id: string) => removeClip({ data: { id } }),
    onSuccess: () => {
      toast.success("Clipe eliminado");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">A carregar…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const { video } = data;
  const clipes = [...(data.clips as ClipRow[])].sort((a, b) => {
    if (sort === "score") return (b.clip_score ?? 0) - (a.clip_score ?? 0);
    if (sort === "duration")
      return Number(b.end_seconds) - Number(b.start_seconds) - (Number(a.end_seconds) - Number(a.start_seconds));
    return a.position - b.position;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{video.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{SOURCE_LABELS[video.source as keyof typeof SOURCE_LABELS] ?? video.source}</span>
            <span>{formatDuration(video.duration_seconds)}</span>
            <Badge variant="secondary">{VIDEO_STATUS_LABELS[video.status] ?? video.status}</Badge>
            <a href={video.url} target="_blank" rel="noreferrer" className="underline">
              Abrir original
            </a>
          </div>
          {video.error_message && <p className="mt-2 text-sm text-destructive">{video.error_message}</p>}
        </div>
        <Button
          variant="ghost"
          onClick={async () => {
            await removeVideo({ data: { id: videoId } });
            toast.success("Vídeo eliminado");
            navigate({ to: "/videos" });
          }}
        >
          <Trash2 className="mr-1 size-4" /> Eliminar vídeo
        </Button>
      </div>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="font-medium">Transcrição</h2>
        <Textarea rows={10} value={transcript} onChange={(e) => setTranscrição(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => transcriptMutation.mutate()}
            disabled={transcriptMutation.isPending}
          >
            Guardar transcrição
          </Button>
          <p className="self-center text-xs text-muted-foreground">
            Os códigos de tempo, como 00:01:24, tornam os tempos dos clipes muito mais precisos.
          </p>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-card p-4">
        <h2 className="font-medium">Deteção de clipes com IA</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Número de clipes</Label>
            <Select value={clipCount} onValueChange={setClipCount}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["3", "5", "10", "20"].map((value) => (
                  <SelectItem key={value} value={value}>
                    {value} clipes
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Duração do clipe</Label>
            <Select value={lengthPreset} onValueChange={(v) => setLengthPreset(v as typeof lengthPreset)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Decisão da IA</SelectItem>
                <SelectItem value="short">Curto · 15–30 s</SelectItem>
                <SelectItem value="medium">Médio · 30–60 s</SelectItem>
                <SelectItem value="long">Longo · 60–180 s</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Idioma do texto</Label>
            <Input value={language} onChange={(e) => setLanguage(e.target.value)} />
          </div>
        </div>
        <Button size="lg" onClick={() => analysisMutation.mutate()} disabled={analysisMutation.isPending}>
          <Sparkles className="mr-1 size-4" />
          {analysisMutation.isPending ? "A analisar…" : clipes.length ? "Repetir análise" : "Encontrar os melhores momentos"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Re-running replaces the current clipes of this video. Scores are quality estimates, not a guarantee of
          virality.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">Generated clipes ({clips.length})</h2>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Ordenar por pontuação</SelectItem>
              <SelectItem value="duration">Ordenar por duração</SelectItem>
              <SelectItem value="position">Ordenar por ordem</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {clips.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No clipes yet. Save the transcript and run the analysis above.
          </p>
        ) : (
          <div className="grid gap-3">
            {clips.map((clip) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                video={{
                  id: video.id,
                  title: video.title,
                  source: video.source,
                  source_id: video.source_id,
                  url: video.url,
                }}
                busy={clipSaveMutation.isPending || clipDeleteMutation.isPending}
                onSave={(patch) => clipSaveMutation.mutate(patch as unknown as Record<string, unknown>)}
                onDelete={(id) => clipDeleteMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
