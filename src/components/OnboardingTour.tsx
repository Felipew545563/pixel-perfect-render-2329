import { useState } from "react";
import {
  Sparkles,
  Link2,
  FileText,
  Wand2,
  Scissors,
  Gauge,
  CircleHelp,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const TOUR_STORAGE_KEY = "clipforge_tour_seen_v1";

const STEPS = [
  {
    icon: Sparkles,
    title: "Welcome to ClipForge Studio",
    text: "Paste a link to a podcast, livestream or interview and let AI turn it into short vertical clips, ready for TikTok, Reels and Shorts. This quick tour takes under a minute.",
  },
  {
    icon: Link2,
    title: "1 · Import a video",
    text: "Go to \"Create clips\" and paste a video link. The source (YouTube, Twitch, Vimeo or other) is detected automatically, so you never upload heavy files.",
  },
  {
    icon: FileText,
    title: "2 · Add the transcript",
    text: "After importing, paste the video transcript in the box provided. The AI reads the transcript in its original language — it works for any language.",
  },
  {
    icon: Wand2,
    title: "3 · Analyze with AI",
    text: "Choose how many clips you want (3 to 20) and the length (15–30s, 30–60s, 60–180s or let AI decide), then run the analysis. Each suggested moment is scored on hook, clarity, emotion, context, retention and shareability.",
  },
  {
    icon: Scissors,
    title: "4 · Review your clips",
    text: "In \"My clips\" you can preview each moment, edit titles and timecodes, copy the ready-to-post caption, title and hashtags — and sort clips by score, duration or date.",
  },
  {
    icon: Gauge,
    title: "5 · Track your usage",
    text: "Every analysis deducts minutes from your plan. Watch the \"Usage\" page for your history and remaining minutes, and use \"Projects\" to keep videos organized by client or series.",
  },
] as const;

export function OnboardingTour({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const close = () => {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, "1");
    } catch {
      // storage unavailable — just close
    }
    onOpenChange(false);
  };

  const next = () => (isLast ? close() : setStep((s) => s + 1));

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-md gap-0 p-0">
        <div className="flex items-start gap-4 border-b border-border p-6">
          <div className="rounded-lg bg-primary/15 p-2.5">
            <current.icon className="size-6 text-primary" />
          </div>
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-lg">{current.title}</DialogTitle>
            <DialogDescription className="leading-relaxed">{current.text}</DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, index) => (
              <span
                key={index}
                aria-hidden
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === step ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30",
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft className="mr-1 size-4" /> Back
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {isLast ? (
                "Start creating"
              ) : (
                <>
                  Next <ArrowRight className="ml-1 size-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TutorialButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start px-2 text-muted-foreground hover:text-foreground"
      onClick={onClick}
    >
      <CircleHelp className="mr-2 size-4" /> How it works
    </Button>
  );
}
