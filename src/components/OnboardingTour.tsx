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
    title: "Bem-vindo ao ClipForge Studio",
    text: "Cole a ligação de um podcast, transmissão em direto ou entrevista e deixe a IA transformá-lo em clipes verticais curtos, prontos para TikTok, Reels e Shorts. Esta visita guiada demora menos de um minuto.",
  },
  {
    icon: Link2,
    title: "1 · Importar um vídeo",
    text: "Aceda a \"Criar clipes\" e cole a ligação de um vídeo. A origem (YouTube, Twitch, Vimeo ou outra) é detetada automaticamente, sem carregar ficheiros pesados.",
  },
  {
    icon: FileText,
    title: "2 · Adicionar a transcrição",
    text: "Depois de importar, cole a transcrição do vídeo no campo indicado. A IA lê a transcrição no idioma original — funciona com qualquer idioma.",
  },
  {
    icon: Wand2,
    title: "3 · Analisar com IA",
    text: "Escolha quantos clipes pretende (3 a 20) e a duração (15–30 s, 30–60 s, 60–180 s ou decisão da IA) e inicie a análise. Cada momento sugerido é avaliado pelo gancho, clareza, emoção, contexto, retenção e potencial de partilha.",
  },
  {
    icon: Scissors,
    title: "4 · Rever os seus clipes",
    text: "Em \"Os meus clipes\", pode pré-visualizar cada momento, editar títulos e códigos de tempo, copiar legendas, títulos e hashtags prontos a publicar e ordenar por pontuação, duração ou data.",
  },
  {
    icon: Gauge,
    title: "5 · Acompanhar a utilização",
    text: "Cada análise desconta minutos do seu plano. Consulte \"Utilização\" para ver os minutos restantes e use \"Projetos\" para organizar vídeos por cliente ou série.",
  },
] as const;

export function OnboardingTour({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[Math.min(step, STEPS.length - 1)] ?? STEPS[0];
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
                <ArrowLeft className="mr-1 size-4" /> Anterior
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {isLast ? (
                "Começar a criar"
              ) : (
                <>
                  Seguinte <ArrowRight className="ml-1 size-4" />
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
      <CircleHelp className="mr-2 size-4" /> Como funciona
    </Button>
  );
}
