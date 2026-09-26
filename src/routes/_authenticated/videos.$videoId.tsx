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
      { title: "Video analysis · ClipForge Studio" },
      { name: "description", content: "Transcript, AI analysis and generated clips for this video." },
      { property: "og:title", content: "Video analysis · ClipForge Studio" },
      { property: "og:description", content: "Transcript, AI analysis and generated clips for this video." },
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

  const [transcript, setTranscript] = useState("");
  const [clipCount, setClipCount] = useState("5");
  const [lengthPreset, setLengthPreset] = useState<"short" | "medium" | "long" | "auto">("auto");
  const [language, setLanguage] = useState("the same language as the transcript");
  const [sort, setSort] = useState<SortKey>("score");

  useEffect(() => {
    if (data?.video) setTranscript(data.video.transcript ?? "");
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
      toast.success("Transcript saved");
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
      toast.success(`${(result as { clips: number }).clips} clips generated`);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const clipSaveMutation = useMutation({
    mutationFn: (patch: Parameters<typeof saveClip>[0] extends never ? never : Record<string, unknown>) =>
      saveClip({ data: patch as never }),
    onSuccess: () => {
      toast.success("Clip updated");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const clipDeleteMutation = useMutation({
    mutationFn: (id: string) => removeClip({ data: { id } }),
    onSuccess: () => {
      toast.success("Clip deleted");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const { video } = data;
  const clips = [...(data.clips as ClipRow[])].sort((a, b) => {
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
              Open original
            </a>
          </p>
          {video.error_message && <p className="mt-2 text-sm text-destructive">{video.error_message}</p>}
        </div>
        <Button
          variant="ghost"
          onClick={async () => {
            await removeVideo({ data: { id: videoId } });
            toast.success("Video deleted");
            navigate({ to: "/videos" });
          }}
        >
          <Trash2 className="mr-1 size-4" /> Delete video
        </Button>
      </div>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="font-medium">Transcript</h2>
        <Textarea rows={10} value={transcript} onChange={(e) => setTranscript(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => transcriptMutation.mutate()}
            disabled={transcriptMutation.isPending}
          >
            Save transcript
          </Button>
          <p className="self-center text-xs text-muted-foreground">
            Timecodes like 00:01:24 make clip timings far more precise.
          </p>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-card p-4">
        <h2 className="font-medium">AI clip detection</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Number of clips</Label>
            <Select value={clipCount} onValueChange={setClipCount}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["3", "5", "10", "20"].map((value) => (
                  <SelectItem key={value} value={value}>
                    {value} clips
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Clip length</Label>
            <Select value={lengthPreset} onValueChange={(v) => setLengthPreset(v as typeof lengthPreset)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">AI decides</SelectItem>
                <SelectItem value="short">Short · 15–30s</SelectItem>
                <SelectItem value="medium">Medium · 30–60s</SelectItem>
                <SelectItem value="long">Long · 60–180s</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Language of the text</Label>
            <Input value={language} onChange={(e) => setLanguage(e.target.value)} />
          </div>
        </div>
        <Button size="lg" onClick={() => analysisMutation.mutate()} disabled={analysisMutation.isPending}>
          <Sparkles className="mr-1 size-4" />
          {analysisMutation.isPending ? "Analyzing…" : clips.length ? "Re-run analysis" : "Find the best moments"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Re-running replaces the current clips of this video. Scores are quality estimates, not a guarantee of
          virality.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">Generated clips ({clips.length})</h2>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Sort by score</SelectItem>
              <SelectItem value="duration">Sort by duration</SelectItem>
              <SelectItem value="position">Sort by order</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {clips.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No clips yet. Save the transcript and run the analysis above.
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
