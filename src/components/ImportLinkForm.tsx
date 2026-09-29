import { useNavigate } from "@tanstack/react-router";
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

type Preview = {
  source: string;
  sourceId: string | null;
  normalizedUrl: string;
  title: string;
  thumbnailUrl: string | null;
  author: string | null;
  durationSeconds: number | null;
};

export function ImportLinkForm({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const inspect = useServerFn(inspectUrl);
  const doImport = useServerFn(importVideo);
  const fetchProjects = useServerFn(listProjects);

  const [url, setUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [projectId, setProjectId] = useState<string>("none");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [showDetails, setShowDetails] = useState(!compact);

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetchProjects({}),
    enabled: showDetails,
  });

  const inspectMutation = useMutation({
    mutationFn: () => inspect({ data: { url } }),
    onSuccess: (data) => {
      setPreview(data as Preview);
      setShowDetails(true);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const importMutation = useMutation({
    mutationFn: () =>
      doImport({
        data: {
          url,
          projectId: projectId === "none" ? null : projectId,
          transcript: transcript.trim() || undefined,
          ...(preview?.durationSeconds ? { durationSeconds: preview.durationSeconds } : {}),
        },
      }),
    onSuccess: (video) => {
      toast.success("Vídeo importado");
      navigate({ to: "/videos/$videoId", params: { videoId: (video as { id: string }).id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="space-y-2">
        <Label htmlFor="url">Ligação da transmissão em direto, podcast ou vídeo</Label>
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

      {!showDetails && (
        <Button variant="ghost" size="sm" onClick={() => setShowDetails(true)}>
          Opções adicionais
        </Button>
      )}

      {showDetails && (
        <>
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
            <Label htmlFor="transcript">Legendas ou diálogo falado do vídeo (opcional)</Label>
            <Textarea
              id="transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={compact ? 4 : 7}
              placeholder={"00:00:03 Orador 1: …\n00:00:18 Orador 2: …"}
            />
            <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Não precisa de escrever nada aqui.</p>
              <p className="mt-1">
                No passo seguinte pode escolher o ficheiro do vídeo e a aplicação ouve o áudio, escreve sozinha o que é
                dito e mede os momentos de maior energia (risos, gritos, aplausos).
              </p>
              <p className="mt-1">
                Se já tiver as legendas, cole-as aqui: no YouTube, em <strong>Mais &gt; Mostrar transcrição</strong>,
                copie e cole.
              </p>
            </div>
          </div>
        </>
      )}

      <Button
        size="lg"
        className="w-full"
        onClick={() => importMutation.mutate()}
        disabled={!url.trim() || importMutation.isPending}
      >
        <Sparkles className="mr-1 size-4" /> Importar vídeo
      </Button>
    </div>
  );
}
