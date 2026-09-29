import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Search, Sparkles } from "lucide-react";

import { importVideo, inspectUrl, listProjects } from "@/lib/studio.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SOURCE_LABELS, formatDuration } from "@/lib/sources";

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

type Preview = {
  source: string;
  sourceId: string | null;
  normalizedUrl: string;
  title: string;
  thumbnailUrl: string | null;
  author: string | null;
  durationSeconds: number | null;
};

function CreatePage() {
  const navigate = useNavigate();
  const inspect = useServerFn(inspectUrl);
  const doImport = useServerFn(importVideo);
  const fetchProjects = useServerFn(listProjects);

  const [url, setUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [projectId, setProjectId] = useState<string>("none");
  const [minutes, setMinutes] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);

  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fetchProjects({}) });

  const inspectMutation = useMutation({
    mutationFn: () => inspect({ data: { url } }),
    onSuccess: (data) => setPreview(data as Preview),
    onError: (error: Error) => toast.error(error.message),
  });

  const importMutation = useMutation({
    mutationFn: () =>
      doImport({
        data: {
          url,
          projectId: projectId === "none" ? null : projectId,
          transcript: transcript.trim() || undefined,
          durationSeconds: minutes.trim() ? Math.round(Number(minutes) * 60) : undefined,
        },
      }),
    onSuccess: (video) => {
      toast.success("Vídeo importado");
      navigate({ to: "/videos/$videoId", params: { videoId: (video as { id: string }).id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Criar clipes</h1>
        <p className="text-sm text-muted-foreground">
          Cole a ligação de uma transmissão em direto, podcast, entrevista ou qualquer vídeo longo.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-card p-4">
        <div className="space-y-2">
          <Label htmlFor="url">Ligação do vídeo</Label>
          <div className="flex gap-2">
            <Input
              id="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setPreview(null);
              }}
              placeholder="https://www.youtube.com/watch?v=…"
            />
            <Button
              variant="outline"
              onClick={() => inspectMutation.mutate()}
              disabled={!url.trim() || inspectMutation.isPending}
            >
              <Search className="mr-1 size-4" /> Verificar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            As ligações públicas do YouTube, Twitch, Vimeo e outras plataformas são detetadas automaticamente.
          </p>
        </div>

        {preview && (
          <div className="flex gap-3 rounded-md border border-border p-3">
            {preview.thumbnailUrl && (
              <img
                src={preview.thumbnailUrl}
                alt=""
                className="h-20 w-32 shrink-0 rounded object-cover"
                loading="lazy"
              />
            )}
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium">{preview.title}</p>
              <p className="text-muted-foreground">
                {SOURCE_LABELS[preview.source as keyof typeof SOURCE_LABELS] ?? preview.source}
                {preview.author ? ` · ${preview.author}` : ""}
                {` · ${formatDuration(preview.durationSeconds)}`}
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Projeto (opcional)</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem projeto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem projeto</SelectItem>
                {(projects.data ?? []).map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="minutes">Duração do vídeo em minutos (opcional)</Label>
            <Input
              id="minutes"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              inputMode="decimal"
              placeholder="ex.: 62"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="transcript">Transcrição</Label>
          <Textarea
            id="transcript"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={8}
            placeholder={"00:00:03 Orador 1: …\n00:00:18 Orador 2: …"}
          />
          <p className="text-xs text-muted-foreground">
            A IA lê a transcrição para encontrar os melhores momentos. Os códigos de tempo tornam os tempos dos clipes muito mais
            precisos. A transcrição automática ainda não está ligada — pode adicionar o vídeo agora e colar a
            transcrição mais tarde.
          </p>
        </div>

        <Button
          size="lg"
          className="w-full"
          onClick={() => importMutation.mutate()}
          disabled={!url.trim() || importMutation.isPending}
        >
          <Sparkles className="mr-1 size-4" /> Importar vídeo
        </Button>
      </div>
    </div>
  );
}
