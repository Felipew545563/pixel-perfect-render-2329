/**
 * Browser-side media analysis helpers.
 *
 * Everything here runs in the user's browser: the original file never leaves
 * the device except as short, low-bitrate audio chunks sent for transcription.
 */

type FF = import("@ffmpeg/ffmpeg").FFmpeg;

const CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";

let ffmpegPromise: Promise<FF> | null = null;

export async function getFFmpeg(): Promise<FF> {
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

export async function writeInput(ff: FF, file: File): Promise<string> {
  const { fetchFile } = await import("@ffmpeg/util");
  const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
  const name = `source.${ext.replace(/[^a-z0-9]/g, "") || "mp4"}`;
  await ff.writeFile(name, await fetchFile(file));
  return name;
}

/** Reads the media duration from the browser itself (no decoding needed). */
export function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      const value = Number.isFinite(el.duration) ? Math.round(el.duration) : null;
      URL.revokeObjectURL(url);
      resolve(value);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    el.src = url;
  });
}

export type AudioChunk = { index: number; startSeconds: number; blob: Blob };

/** Splits the audio track into low-bitrate mono chunks ready for transcription. */
export async function extractAudioChunks(
  ff: FF,
  inputName: string,
  chunkSeconds: number,
  onStatus?: (message: string) => void,
): Promise<AudioChunk[]> {
  onStatus?.("A separar o áudio do vídeo…");
  const code = await ff.exec([
    "-i", inputName,
    "-vn",
    "-ac", "1",
    "-ar", "16000",
    "-c:a", "aac",
    "-b:a", "24k",
    "-f", "segment",
    "-segment_format", "adts",
    "-segment_time", String(chunkSeconds),
    "-reset_timestamps", "1",
    "seg%04d.aac",
  ]);
  if (code !== 0) throw new Error("Não foi possível ler o áudio deste ficheiro.");

  const entries = await ff.listDir("/");
  const names = entries
    .map((entry) => entry.name)
    .filter((name) => /^seg\d{4}\.aac$/.test(name))
    .sort();

  const chunks: AudioChunk[] = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i]!;
    const data = (await ff.readFile(name)) as Uint8Array;
    await ff.deleteFile(name);
    if (data.byteLength < 800) continue;
    chunks.push({
      index: i,
      startSeconds: i * chunkSeconds,
      blob: new Blob([data.slice().buffer], { type: "audio/aac" }),
    });
  }
  if (!chunks.length) throw new Error("Este ficheiro não tem faixa de áudio utilizável.");
  return chunks;
}

export type EnergyPeak = { startSeconds: number; endSeconds: number; intensity: number };

/**
 * Finds loud, high-energy stretches (laughter, shouting, applause, hype) from
 * the raw waveform. These give second-accurate candidate moments even when the
 * speech is unclear or there is no transcript at all.
 */
export async function detectEnergyPeaks(
  ff: FF,
  inputName: string,
  onStatus?: (message: string) => void,
): Promise<EnergyPeak[]> {
  onStatus?.("A analisar a energia do som (risos, gritos, reações)…");
  const out = "energy.wav";
  const code = await ff.exec(["-i", inputName, "-vn", "-ac", "1", "-ar", "8000", "-f", "wav", out]);
  if (code !== 0) throw new Error("Não foi possível analisar o som deste ficheiro.");
  const data = (await ff.readFile(out)) as Uint8Array;
  await ff.deleteFile(out);

  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  let samples: Float32Array;
  let sampleRate: number;
  try {
    const buffer = await ctx.decodeAudioData(data.slice().buffer as ArrayBuffer);
    samples = buffer.getChannelData(0);
    sampleRate = buffer.sampleRate;
  } finally {
    void ctx.close();
  }

  const windowSeconds = 0.5;
  const windowSize = Math.max(1, Math.round(sampleRate * windowSeconds));
  const rms: number[] = [];
  for (let i = 0; i < samples.length; i += windowSize) {
    let sum = 0;
    const end = Math.min(samples.length, i + windowSize);
    for (let j = i; j < end; j++) sum += samples[j]! * samples[j]!;
    rms.push(Math.sqrt(sum / Math.max(1, end - i)));
  }
  if (rms.length < 4) return [];

  const mean = rms.reduce((a, b) => a + b, 0) / rms.length;
  const variance = rms.reduce((a, b) => a + (b - mean) ** 2, 0) / rms.length;
  const std = Math.sqrt(variance);
  const threshold = mean + std * 0.9;
  const max = Math.max(...rms);

  const peaks: EnergyPeak[] = [];
  let runStart: number | null = null;
  let runPeak = 0;
  for (let i = 0; i < rms.length; i++) {
    const loud = rms[i]! >= threshold;
    if (loud) {
      runStart ??= i;
      runPeak = Math.max(runPeak, rms[i]!);
    }
    if ((!loud || i === rms.length - 1) && runStart !== null) {
      const startSeconds = runStart * windowSeconds;
      const endSeconds = (i + 1) * windowSeconds;
      if (endSeconds - startSeconds >= 1) {
        peaks.push({
          startSeconds: Math.round(startSeconds),
          endSeconds: Math.round(endSeconds),
          intensity: Math.round((runPeak / (max || 1)) * 100),
        });
      }
      runStart = null;
      runPeak = 0;
    }
  }

  // Merge peaks that are close together, then keep the strongest ones.
  const merged: EnergyPeak[] = [];
  for (const peak of peaks) {
    const previous = merged[merged.length - 1];
    if (previous && peak.startSeconds - previous.endSeconds <= 3) {
      previous.endSeconds = peak.endSeconds;
      previous.intensity = Math.max(previous.intensity, peak.intensity);
    } else {
      merged.push({ ...peak });
    }
  }
  return merged.sort((a, b) => b.intensity - a.intensity).slice(0, 60).sort((a, b) => a.startSeconds - b.startSeconds);
}

/** Grabs small still frames so the AI can also judge what is visible on screen. */
export async function extractFrames(
  ff: FF,
  inputName: string,
  seconds: number[],
  onStatus?: (message: string) => void,
): Promise<string[]> {
  const frames: string[] = [];
  for (let i = 0; i < seconds.length; i++) {
    onStatus?.(`A observar a imagem do vídeo (${i + 1}/${seconds.length})…`);
    const out = `frame-${i}.jpg`;
    try {
      const code = await ff.exec([
        "-ss", String(Math.max(0, Math.round(seconds[i]!))),
        "-i", inputName,
        "-frames:v", "1",
        "-vf", "scale=420:-2",
        "-q:v", "6",
        out,
      ]);
      if (code !== 0) continue;
      const data = (await ff.readFile(out)) as Uint8Array;
      await ff.deleteFile(out);
      if (!data.byteLength) continue;
      frames.push(await blobToDataUrl(new Blob([data.slice().buffer], { type: "image/jpeg" })));
    } catch {
      // a single unreadable frame must not stop the analysis
    }
  }
  return frames;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(blob);
  });
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
