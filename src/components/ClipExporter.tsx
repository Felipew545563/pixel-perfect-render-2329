import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Scissors, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatTimecode } from "@/lib/sources";
import type { ClipRow } from "@/components/ClipCard";

type Result = { id: string; name: string; url: string; size: number };

const CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";

// ffmpeg is browser-only; loaded lazily after the user clicks.
type FF = import("@ffmpeg/ffmpeg").FFmpeg;
let ffmpegPromise: Promise<FF> | null = null;
async function getFFmpeg(): Promise<FF> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([import("@ffmpeg/ffmpeg"), import("@ffmpeg/util")]);
      const ff = new FFmpeg();
      await ff.load({
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ff;
    })().catch((err) => {
      ffmpegPromise = null;
      throw err;
    });
  }
  return ffmpegPromise;
}

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 50) || "clipe";

export function ClipExporter({ clips }: { clips: ClipRow[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Result[]>([]);

  const run = async () => {
    if (!file || clips.length === 0) return;
    setRunning(true);
    setProgress(0);
    results.forEach((r) => URL.revokeObjectURL(r.url));
    setResults([]);
    try {
      setStatus("A preparar o editor de vídeo…");
      const ff = await getFFmpeg();
      const { fetchFile } = await import("@ffmpeg/util");
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const inputName = `input.${ext}`;
      setStatus("A carregar o vídeo original…");
      await ff.writeFile(inputName, await fetchFile(file));

      const ordered = [...clips].sort((a, b) => a.position - b.position);
      for (let i = 0; i < ordered.length; i++) {
        const clip = ordered[i]!;
        const start = Number(clip.start_seconds);
        const duration = Math.max(1, Number(clip.end_seconds) - start);
        setStatus(`A cortar o clipe ${i + 1} de ${ordered.length}: ${clip.title}`);
        const onProgress = ({ progress: p }: { progress: number }) =>
          setProgress(Math.round(((i + Math.min(1, Math.max(0, p))) / ordered.length) * 100));
        ff.on("progress", onProgress);
        const out = `clip-${i}.mp4`;
        const code = await ff.exec([
          "-ss", String(start),
          "-i", inputName,
          "-t", String(duration),
          "-vf", "crop=w='min(iw,ih*9/16)':h='min(ih,iw*16/9)',scale=1080:1920,setsar=1",
          "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
          "-c:a", "aac", "-b:a", "128k",
          "-movflags", "+faststart",
          out,
        ]);
        ff.off("progress", onProgress);
        if (code !== 0) throw new Error(`Não foi possível cortar o clipe "${clip.title}".`);
        const data = (await ff.readFile(out)) as Uint8Array;
        await ff.deleteFile(out);
        const blob = new Blob([data.slice().buffer], { type: "video/mp4" });
        const result: Result = {
          id: clip.id,
          name: `${String(clip.position).padStart(2, "0")}-${slug(clip.title)}.mp4`,
          url: URL.createObjectURL(blob),
          size: blob.size,
        };
        setResults((prev) => [...prev, result]);
      }
      await ff.deleteFile(inputName);
      setProgress(100);
      setStatus("Concluído. Os ficheiros estão prontos a descarregar.");
      toast.success("Clipes cortados com sucesso");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ocorreu um erro ao cortar os clipes.";
      setStatus(message);
      toast.error(message);
    } finally {
      setRunning(false);
    }
  };

  const downloadAll = () => {
    results.forEach((r, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = r.url;
        a.download = r.name;
        a.click();
      }, i * 400);
    });
  };

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="font-medium">Cortar em ficheiros de vídeo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Carregue o ficheiro original deste vídeo. Os clipes são cortados no seu navegador, em formato vertical 9:16
          (1080×1920), e o vídeo nunca sai do seu computador.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={running}>
          <Upload className="mr-1 size-4" /> {file ? "Escolher outro ficheiro" : "Escolher ficheiro de vídeo"}
        </Button>
        {file && (
          <span className="text-sm text-muted-foreground">
            {file.name} · {(file.size / 1024 / 1024).toFixed(0)} MB
          </span>
        )}
      </div>
      <Button onClick={run} disabled={!file || running || clips.length === 0}>
        <Scissors className="mr-1 size-4" />
        {running ? "A cortar…" : `Cortar ${clips.length} clipes em vídeo`}
      </Button>
      {file && file.size > 1.5 * 1024 * 1024 * 1024 && (
        <p className="text-xs text-destructive">
          Ficheiros acima de 1,5 GB podem falhar no navegador. Se possível, use uma versão mais leve do vídeo.
        </p>
      )}
      {(running || status) && (
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground">{status}</p>
          {running && (
            <p className="text-xs text-muted-foreground">
              Pode demorar alguns minutos por clipe. Mantenha esta página aberta.
            </p>
          )}
        </div>
      )}
      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Ficheiros prontos ({results.length})</h3>
            <Button size="sm" variant="secondary" onClick={downloadAll} disabled={running}>
              <Download className="mr-1 size-3.5" /> Descarregar todos
            </Button>
          </div>
          <ul className="space-y-2">
            {results.map((r) => {
              const clip = clips.find((c) => c.id === r.id);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border p-2">
                  <video src={r.url} className="h-24 w-[54px] rounded bg-muted object-cover" muted />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{clip?.title ?? r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {clip && `${formatTimecode(Number(clip.start_seconds))} – ${formatTimecode(Number(clip.end_seconds))} · `}
                      {(r.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <a href={r.url} download={r.name}>
                      <Download className="mr-1 size-3.5" /> Descarregar
                    </a>
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
