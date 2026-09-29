import { useRef, useState } from "react";
import { AudioLines, Download, Link2, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { getFFmpeg, readDuration, writeInput, formatClock } from "@/lib/media-analysis";
import { supabase } from "@/integrations/supabase/client";

type Preset = "leve" | "musica";
type Mode = "ligacao" | "ficheiro";

const PRESETS: Record<Preset, { label: string; hint: string; ext: string; args: string[] }> = {
  leve: {
    label: "Leve (ideal para análise)",
    hint: "Voz em mono, ficheiro muito pequeno — perfeito para gerar clipes.",
    ext: "m4a",
    args: ["-vn", "-ac", "1", "-ar", "16000", "-c:a", "aac", "-b:a", "32k"],
  },
  musica: {
    label: "Qualidade alta (MP3)",
    hint: "Estéreo a 192 kbps — para guardar ou publicar o áudio.",
    ext: "mp3",
    args: ["-vn", "-ac", "2", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "192k"],
  },
};

function slug(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "audio"
  );
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("A sua sessão expirou. Volte a iniciar sessão.");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export function AudioExtractor() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("ligacao");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preset, setPreset] = useState<Preset>("leve");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; name: string; size: number; duration: number | null } | null>(
    null,
  );

  function reset() {
    setError(null);
    setResult((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  function pick(next: File | null) {
    setFile(next);
    reset();
  }

  async function convert(source: File) {
    const duration = await readDuration(source);
    const ff = await getFFmpeg();
    const onProgress = ({ progress: value }: { progress: number }) =>
      setProgress(Math.min(99, Math.round(value * 100)));
    ff.on("progress", onProgress);
    setStatus("A separar o áudio do ficheiro…");
    const input = await writeInput(ff, source);
    const config = PRESETS[preset];
    const output = `${slug(source.name)}.${config.ext}`;
    try {
      const code = await ff.exec(["-i", input, ...config.args, output]);
      if (code !== 0) throw new Error("Não foi possível extrair o áudio deste ficheiro.");
      const data = (await ff.readFile(output)) as Uint8Array;
      const blob = new Blob([data.slice().buffer], {
        type: config.ext === "mp3" ? "audio/mpeg" : "audio/mp4",
      });
      setResult({ url: URL.createObjectURL(blob), name: output, size: blob.size, duration });
      setProgress(100);
      setStatus("Áudio pronto.");
      await ff.deleteFile(output);
    } finally {
      ff.off("progress", onProgress);
      await ff.deleteFile(input).catch(() => undefined);
    }
  }

  async function handleExtractFile() {
    if (!file) return;
    setBusy(true);
    reset();
    setProgress(0);
    setStatus("A preparar as ferramentas de áudio…");
    try {
      await convert(file);
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : "Algo falhou ao extrair o áudio.");
    } finally {
      setBusy(false);
    }
  }

  async function handleExtractLink() {
    const value = link.trim();
    if (!value) return;
    setBusy(true);
    reset();
    setProgress(0);
    setStatus("A localizar o áudio desta ligação…");
    try {
      const headers = await authHeaders();
      const resolveResponse = await fetch("/api/resolve-audio", {
        method: "POST",
        headers,
        body: JSON.stringify({ url: value }),
      });
      const resolved = (await resolveResponse.json().catch(() => null)) as
        | { audioUrl?: string; filename?: string; error?: string }
        | null;
      if (!resolveResponse.ok || !resolved?.audioUrl) {
        throw new Error(resolved?.error ?? "Não foi possível obter o áudio desta ligação.");
      }

      setStatus("A transferir o áudio…");
      const download = await fetch("/api/fetch-audio", {
        method: "POST",
        headers,
        body: JSON.stringify({ url: resolved.audioUrl }),
      });
      if (!download.ok) {
        const detail = (await download.json().catch(() => null)) as { error?: string } | null;
        throw new Error(detail?.error ?? "A transferência do áudio falhou.");
      }
      const blob = await download.blob();
      if (blob.size < 1024) throw new Error("O áudio recebido está vazio. Tente outra ligação.");

      const name = resolved.filename || "audio-da-ligacao.mp3";
      const downloaded = new File([blob], name, { type: blob.type || "audio/mpeg" });
      setFile(downloaded);
      setStatus("A converter o áudio…");
      await convert(downloaded);
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : "Algo falhou ao obter o áudio.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <AudioLines className="mt-0.5 size-5 text-primary" />
        <div>
          <h2 className="font-semibold">Extrair o áudio de um vídeo ou direto</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cole a ligação de uma gravação da Twitch, Kick, YouTube ou de um podcast — ou escolha um
            ficheiro que já tenha. Fica só com o som, num ficheiro muito mais pequeno e rápido de analisar.
          </p>
        </div>
      </div>

      <div className="mt-5 inline-flex rounded-lg border border-border p-1">
        {(
          [
            { key: "ligacao" as Mode, label: "Por ligação" },
            { key: "ficheiro" as Mode, label: "Por ficheiro" },
          ]
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            disabled={busy}
            onClick={() => {
              setMode(tab.key);
              reset();
            }}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              mode === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {(Object.keys(PRESETS) as Preset[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setPreset(key)}
            disabled={busy}
            className={`rounded-lg border p-3 text-left transition-colors ${
              preset === key
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/40 hover:bg-accent"
            }`}
          >
            <span className="block text-sm font-medium">{PRESETS[key].label}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{PRESETS[key].hint}</span>
          </button>
        ))}
      </div>

      {mode === "ligacao" ? (
        <div className="mt-5 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={link}
              onChange={(event) => setLink(event.target.value)}
              disabled={busy}
              placeholder="https://www.twitch.tv/videos/… ou https://kick.com/…"
              inputMode="url"
            />
            <Button type="button" onClick={handleExtractLink} disabled={busy || !link.trim()}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Link2 className="mr-2 size-4" />}
              Obter áudio
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Funciona com gravações já terminadas (VOD), clipes e ficheiros de áudio públicos. Algumas
            plataformas limitam transferências: se falhar, descarregue a gravação e use «Por ficheiro».
          </p>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="video/*,audio/*"
            className="hidden"
            onChange={(event) => pick(event.target.files?.[0] ?? null)}
          />
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
              <Upload className="mr-2 size-4" /> Escolher ficheiro
            </Button>
            <Button type="button" onClick={handleExtractFile} disabled={!file || busy}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <AudioLines className="mr-2 size-4" />}
              Extrair áudio
            </Button>
            {file ? (
              <span className="text-xs text-muted-foreground">
                {file.name} · {formatSize(file.size)}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Nenhum ficheiro escolhido.</span>
            )}
          </div>
        </>
      )}

      {busy || status ? (
        <div className="mt-4 space-y-2">
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground">{status}</p>
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      {result ? (
        <div className="mt-5 space-y-3 rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">{result.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatSize(result.size)}
            {result.duration ? ` · ${formatClock(result.duration)} de duração` : ""}
          </p>
          <audio controls src={result.url} className="w-full" />
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <a href={result.url} download={result.name}>
                <Download className="mr-2 size-4" /> Descarregar áudio
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Pode agora usar este ficheiro na «Análise automática» da página do vídeo para gerar os clipes.
          </p>
        </div>
      ) : null}
    </section>
  );
}
