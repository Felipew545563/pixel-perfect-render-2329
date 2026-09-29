import { useRef, useState } from "react";
import { AudioLines, Download, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getFFmpeg, readDuration, writeInput, formatClock } from "@/lib/media-analysis";

type Preset = "leve" | "musica";

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

export function AudioExtractor() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preset, setPreset] = useState<Preset>("leve");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; name: string; size: number; duration: number | null } | null>(
    null,
  );

  function pick(next: File | null) {
    setFile(next);
    setError(null);
    setResult((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  async function handleExtract() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    setStatus("A preparar as ferramentas de áudio…");
    try {
      const duration = await readDuration(file);
      const ff = await getFFmpeg();
      const onProgress = ({ progress: value }: { progress: number }) =>
        setProgress(Math.min(99, Math.round(value * 100)));
      ff.on("progress", onProgress);
      setStatus("A separar o áudio do ficheiro…");
      const input = await writeInput(ff, file);
      const config = PRESETS[preset];
      const output = `${slug(file.name)}.${config.ext}`;
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
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : "Algo falhou ao extrair o áudio.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <AudioLines className="mt-0.5 size-5 text-primary" />
        <div>
          <h2 className="font-semibold">Extrair o áudio de um vídeo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha a gravação (de um direto da Twitch, Kick, YouTube ou do seu telemóvel) e fique só com
            o som. O ficheiro é muito mais pequeno e a análise com IA fica bem mais rápida. Tudo é feito
            no seu computador — nada é enviado para fora.
          </p>
        </div>
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
        <Button type="button" onClick={handleExtract} disabled={!file || busy}>
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
