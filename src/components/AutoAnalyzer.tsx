import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AudioLines, Upload, Wand2 } from "lucide-react";

import { analyzeVideo, updateVideo } from "@/lib/studio.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  detectEnergyPeaks,
  extractAudioChunks,
  extractFrames,
  formatClock,
  getFFmpeg,
  readDuration,
  writeInput,
  type EnergyPeak,
} from "@/lib/media-analysis";

const CHUNK_SECONDS = 60;

type Mode = "hybrid" | "speech" | "energy";

const MODE_LABELS: Record<Mode, string> = {
  hybrid: "Automático inteligente (recomendado)",
  speech: "Conversa e podcast",
  energy: "Humor, reações e direto",
};

const MODE_HELP: Record<Mode, string> = {
  hybrid: "Junta o que é dito, os picos de som (risos, gritos, aplausos) e o que aparece na imagem.",
  speech: "Dá prioridade a histórias, argumentos completos e frases marcantes.",
  energy: "Dá prioridade a gargalhadas, surpresa e momentos de maior energia.",
};

export function AutoAnalyzer({
  videoId,
  clipCount,
  language,
  lengthPreset,
}: {
  videoId: string;
  clipCount: number;
  language: string;
  lengthPreset: "short" | "medium" | "long" | "auto";
}) {
  const queryClient = useQueryClient();
  const saveVideo = useServerFn(updateVideo);
  const runAnalysis = useServerFn(analyzeVideo);

  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>("hybrid");
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<string | null>(null);

  const transcribeChunk = async (blob: Blob, index: number): Promise<string> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("A sessão expirou. Volte a iniciar sessão.");

    const body = new FormData();
    body.append("file", blob, `parte-${index}.aac`);

    const response = await fetch("/api/transcribe", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    const json = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
    if (!response.ok) throw new Error(json.error || "Não foi possível transcrever o áudio.");
    return (json.text ?? "").trim();
  };

  const pipeline = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Escolha o ficheiro original do vídeo.");
      setProgress(2);
      setSummary(null);

      setStatus("A preparar o motor de vídeo…");
      const ff = await getFFmpeg();
      const duration = await readDuration(file);
      setStatus("A carregar o ficheiro…");
      const inputName = await writeInput(ff, file);

      let peaks: EnergyPeak[] = [];
      if (mode !== "speech") {
        peaks = await detectEnergyPeaks(ff, inputName, setStatus);
        setProgress(12);
      }

      const chunks = await extractAudioChunks(ff, inputName, CHUNK_SECONDS, setStatus);
      setProgress(18);
      const pieces: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]!;
        setStatus(`A ouvir e escrever o que é dito (${i + 1}/${chunks.length})…`);
        try {
          const text = await transcribeChunk(chunk.blob, i);
          if (text) pieces.push(`[${formatClock(chunk.startSeconds)}] ${text}`);
        } catch (err) {
          if (i === 0) throw err;
          // a failed middle chunk must not lose the whole transcript
        }
        setProgress(18 + Math.round(((i + 1) / chunks.length) * 55));
      }
      const transcript = pieces.join("\n");

      let frames: string[] = [];
      if (mode === "hybrid") {
        const spots = (peaks.length ? peaks.slice(0, 6).map((peak) => peak.startSeconds) : [])
          .concat(duration ? [duration * 0.15, duration * 0.5, duration * 0.8] : [])
          .slice(0, 6)
          .sort((a, b) => a - b);
        if (spots.length) frames = await extractFrames(ff, inputName, spots, setStatus);
      }
      setProgress(80);

      await ff.deleteFile(inputName).catch(() => undefined);

      if (transcript.trim()) {
        setStatus("A guardar o texto do vídeo…");
        await saveVideo({
          data: { id: videoId, transcript, transcriptSource: "auto", ...(duration ? { durationSeconds: duration } : {}) },
        });
      } else if (duration) {
        await saveVideo({ data: { id: videoId, durationSeconds: duration } });
      }

      setStatus("A IA está a escolher os melhores momentos…");
      setProgress(88);
      const result = await runAnalysis({
        data: {
          id: videoId,
          clipCount,
          lengthPreset,
          language,
          replaceExisting: true,
          detectionMode: mode,
          energyPeaks: peaks.map((peak) => ({
            startSeconds: peak.startSeconds,
            endSeconds: peak.endSeconds,
            intensity: peak.intensity,
          })),
          frames,
        },
      });

      setProgress(100);
      return {
        clips: (result as { clips: number }).clips,
        peaks: peaks.length,
        words: transcript.split(/\s+/).filter(Boolean).length,
        frames: frames.length,
      };
    },
    onSuccess: (result) => {
      setStatus("Concluído.");
      setSummary(
        `${result.clips} clipes encontrados · ${result.words} palavras ouvidas · ${result.peaks} picos de som` +
          (result.frames ? ` · ${result.frames} imagens analisadas` : ""),
      );
      toast.success(`${result.clips} clipes encontrados`);
      queryClient.invalidateQueries({ queryKey: ["video", videoId] });
      queryClient.invalidateQueries({ queryKey: ["clips"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
    },
    onError: (err: Error) => {
      setStatus(err.message);
      toast.error(err.message);
    },
  });

  const running = pipeline.isPending;

  return (
    <section className="space-y-4 rounded-lg border border-primary/40 bg-card p-4">
      <div>
        <h2 className="flex items-center gap-2 font-medium">
          <AudioLines className="size-4 text-primary" /> Análise automática (sem escrever nada)
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha o ficheiro original. A aplicação ouve o áudio, escreve sozinha o que é dito com as horas certas, mede
          os picos de som e olha para a imagem para encontrar os melhores momentos.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>O que deve procurar</Label>
          <Select value={mode} onValueChange={(value) => setMode(value as Mode)} disabled={running}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(MODE_LABELS) as Mode[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {MODE_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{MODE_HELP[mode]}</p>
        </div>
        <div className="space-y-2">
          <Label>Ficheiro original</Label>
          <input
            ref={inputRef}
            type="file"
            accept="video/*,audio/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button variant="outline" className="w-full" onClick={() => inputRef.current?.click()} disabled={running}>
            <Upload className="mr-1 size-4" /> {file ? "Escolher outro ficheiro" : "Escolher vídeo ou áudio"}
          </Button>
          {file && (
            <p className="truncate text-xs text-muted-foreground">
              {file.name} · {(file.size / 1024 / 1024).toFixed(0)} MB
            </p>
          )}
        </div>
      </div>

      <Button size="lg" className="w-full" onClick={() => pipeline.mutate()} disabled={!file || running}>
        <Wand2 className="mr-1 size-4" /> {running ? "A analisar…" : "Analisar e encontrar clipes"}
      </Button>

      {(running || status) && (
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground">{status}</p>
          {running && (
            <p className="text-xs text-muted-foreground">
              Mantenha esta página aberta. Vídeos longos podem demorar vários minutos.
            </p>
          )}
        </div>
      )}

      {summary && <p className="text-xs text-primary">{summary}</p>}
    </section>
  );
}
