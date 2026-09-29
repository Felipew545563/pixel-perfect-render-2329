import { useState } from "react";
import { toast } from "sonner";
import { Copy, Trash2, Save, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { clipEmbedUrl, formatTimecode } from "@/lib/sources";

export type ClipRow = {
  id: string;
  video_id: string;
  position: number;
  title: string;
  hook: string | null;
  description: string | null;
  start_seconds: number | string;
  end_seconds: number | string;
  clip_score: number | null;
  hook_score: number | null;
  emotion_score: number | null;
  clarity_score: number | null;
  reasoning: string | null;
  transcript_excerpt: string | null;
  hashtags: string[] | null;
  caption_tiktok: string | null;
  caption_instagram: string | null;
  youtube_title: string | null;
};

export type ClipVideo = {
  id: string;
  title: string;
  source: string;
  source_id: string | null;
  url: string;
};

const num = (value: number | string) => (typeof value === "number" ? value : Number(value) || 0);

function scoreTone(score: number | null) {
  if (score === null) return "bg-muted text-muted-foreground";
  if (score >= 80) return "bg-primary/20 text-primary";
  if (score >= 60) return "bg-accent text-accent-foreground";
  return "bg-muted text-muted-foreground";
}

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  } catch {
    toast.error("Não foi possível copiar");
  }
}

export function ClipCard({
  clip,
  video,
  onSave,
  onDelete,
  busy,
}: {
  clip: ClipRow;
  video?: ClipVideo | undefined;
  onSave: (patch: {
    id: string;
    title: string;
    hook: string;
    description: string;
    startSeconds: number;
    endSeconds: number;
  }) => void;
  onDelete: (id: string) => void;
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(clip.title);
  const [hook, setHook] = useState(clip.hook ?? "");
  const [description, setDescription] = useState(clip.description ?? "");
  const [start, setStart] = useState(String(num(clip.start_seconds)));
  const [end, setEnd] = useState(String(num(clip.end_seconds)));

  const startSec = num(clip.start_seconds);
  const endSec = num(clip.end_seconds);
  const embed = video ? clipEmbedUrl(video.source, video.source_id, video.url, startSec, endSec) : null;
  const hashtags = (clip.hashtags ?? []).map((tag) => `#${tag}`).join(" ");

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Clipe n.º {clip.position}</span>
            <Badge className={scoreTone(clip.clip_score)} variant="secondary">
              Pontuação {clip.clip_score ?? "—"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatTimecode(startSec)} – {formatTimecode(endSec)} · {Math.round(endSec - startSec)}s
            </span>
          </div>
          <h3 className="mt-1 truncate font-medium">{clip.title}</h3>
          {clip.hook && <p className="mt-1 text-sm text-muted-foreground">{clip.hook}</p>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            <Play className="mr-1 size-3.5" /> {open ? "Ocultar" : "Pré-visualizar"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(clip.id)} disabled={busy}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-4">
          <div className="mx-auto w-full max-w-[280px]">
            <div className="aspect-[9/16] overflow-hidden rounded-md border border-border bg-muted">
              {embed ? (
                <iframe
                  src={embed}
                  title={clip.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-muted-foreground">
                  Não existe pré-visualização incorporada para esta origem.
                  {video && (
                    <a className="underline" href={video.url} target="_blank" rel="noreferrer">
                      Abrir o vídeo original
                    </a>
                  )}
                </div>
              )}
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Pré-visualização em 9:16. O segmento é reproduzido a partir do vídeo original.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["Gancho", clip.hook_score],
              ["Emoção", clip.emotion_score],
              ["Clareza", clip.clarity_score],
              ["Geral", clip.clip_score],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-md border border-border p-2 text-center">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-semibold">{value ?? "—"}</p>
              </div>
            ))}
          </div>

          {clip.reasoning && (
            <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{clip.reasoning}</p>
          )}
          {clip.transcript_excerpt && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">Transcrição deste momento</summary>
              <p className="mt-2 whitespace-pre-wrap">{clip.transcript_excerpt}</p>
            </details>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <Button size="sm" variant="outline" onClick={() => copy(clip.caption_tiktok ?? "", "Legenda do TikTok")}>
              <Copy className="mr-1 size-3.5" /> Legenda do TikTok
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copy(clip.caption_instagram ?? "", "Legenda do Instagram")}
            >
              <Copy className="mr-1 size-3.5" /> Legenda do Instagram
            </Button>
            <Button size="sm" variant="outline" onClick={() => copy(clip.youtube_title ?? "", "Título do YouTube")}>
              <Copy className="mr-1 size-3.5" /> Título para YouTube Shorts
            </Button>
            <Button size="sm" variant="outline" onClick={() => copy(hashtags, "Hashtags")}>
              <Copy className="mr-1 size-3.5" /> Hashtags
            </Button>
          </div>

          {!editing ? (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Editar clipe
            </Button>
          ) : (
            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="space-y-1">
                <Label>Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Gancho</Label>
                <Input value={hook} onChange={(e) => setHook(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Descrição</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Início (segundos)</Label>
                  <Input value={start} onChange={(e) => setStart(e.target.value)} inputMode="numeric" />
                </div>
                <div className="space-y-1">
                  <Label>Fim (segundos)</Label>
                  <Input value={end} onChange={(e) => setEnd(e.target.value)} inputMode="numeric" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    const s = Number(start);
                    const e = Number(end);
                    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) {
                      toast.error("O fim tem de ser posterior ao início.");
                      return;
                    }
                    onSave({ id: clip.id, title, hook, description, startSeconds: s, endSeconds: e });
                    setEditing(false);
                  }}
                >
                  <Save className="mr-1 size-3.5" /> Guardar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
