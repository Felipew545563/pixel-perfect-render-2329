/**
 * Transcription layer.
 *
 * The app server cannot download or decode media itself, so automatic
 * transcription requires an external speech-to-text provider.
 *
 * To enable it, add a secret named TRANSCRIPTION_API_KEY (AssemblyAI-compatible)
 * and implement `requestRemoteTranscript` below. Until then the app asks the
 * user to paste a transcript instead of pretending it transcribed the audio.
 */

export type TranscriptResult = {
  text: string;
  source: "user" | "provider";
};

export function hasTranscriptionProvider(): boolean {
  return Boolean(process.env["TRANSCRIPTION_API_KEY"]);
}

export async function requestRemoteTranscript(_mediaUrl: string): Promise<TranscriptResult> {
  // <-- ADD THE PROVIDER CALL HERE once TRANSCRIPTION_API_KEY is configured.
  throw new Error(
    "Automatic transcription is not connected yet. Paste the transcript for now, or add a speech-to-text provider key.",
  );
}
