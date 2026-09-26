import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { deleteClip, listClips, updateClip } from "@/lib/studio.functions";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipCard, type ClipRow, type ClipVideo } from "@/components/ClipCard";

export const Route = createFileRoute("/_authenticated/clips")({
  head: () => ({
    meta: [
      { title: "My clips · ClipForge Studio" },
      { name: "description", content: "Every clip the AI found, with titles, hooks, captions and hashtags." },
      { property: "og:title", content: "My clips · ClipForge Studio" },
      { property: "og:description", content: "Every clip the AI found, with titles, hooks, captions and hashtags." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClipsPage,
});

function ClipsPage() {
  const fetchClips = useServerFn(listClips);
  const saveClip = useServerFn(updateClip);
  const removeClip = useServerFn(deleteClip);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["clips"], queryFn: () => fetchClips({}) });
  const [term, setTerm] = useState("");
  const [sort, setSort] = useState<"score" | "newest" | "duration">("score");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["clips"] });
    queryClient.invalidateQueries({ queryKey: ["overview"] });
  };

  const saveMutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) => saveClip({ data: patch as never }),
    onSuccess: () => {
      toast.success("Clip updated");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeClip({ data: { id } }),
    onSuccess: () => {
      toast.success("Clip deleted");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const videos = new Map<string, ClipVideo>(
    ((data?.videos ?? []) as ClipVideo[]).map((video) => [video.id, video]),
  );

  const clips = ((data?.clips ?? []) as ClipRow[])
    .filter((clip) => {
      const q = term.trim().toLowerCase();
      if (!q) return true;
      return (
        clip.title.toLowerCase().includes(q) ||
        (clip.hook ?? "").toLowerCase().includes(q) ||
        (clip.transcript_excerpt ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sort === "score") return (b.clip_score ?? 0) - (a.clip_score ?? 0);
      if (sort === "duration")
        return Number(b.end_seconds) - Number(b.start_seconds) - (Number(a.end_seconds) - Number(a.start_seconds));
      return 0;
    });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My clips</h1>
        <p className="text-sm text-muted-foreground">All clips across your videos.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-sm"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search clips and transcripts…"
        />
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score">Sort by score</SelectItem>
            <SelectItem value="duration">Sort by duration</SelectItem>
            <SelectItem value="newest">Newest first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && clips.length === 0 && (
        <p className="text-sm text-muted-foreground">No clips yet. Import a video and run the analysis.</p>
      )}

      <div className="grid gap-3">
        {clips.map((clip) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            video={videos.get(clip.video_id)}
            busy={saveMutation.isPending || deleteMutation.isPending}
            onSave={(patch) => saveMutation.mutate(patch as unknown as Record<string, unknown>)}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        ))}
      </div>
    </div>
  );
}
