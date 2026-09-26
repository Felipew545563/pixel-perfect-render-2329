import { createFileRoute, Link } from "@tanstack/react-router";
import { Scissors, Wand2, Captions, Crop } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ClipForge Studio · AI clips from long videos" },
      {
        name: "description",
        content:
          "Paste a podcast, livestream or interview link and let AI find the strongest moments, ready for TikTok, Reels and Shorts.",
      },
      { property: "og:title", content: "ClipForge Studio · AI clips from long videos" },
      {
        property: "og:description",
        content: "AI finds the best moments of your long videos and turns them into short-form clips.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Wand2, title: "AI moment detection", text: "Hook, development and payoff scored for each suggested clip." },
  { icon: Captions, title: "Ready-to-post copy", text: "Titles, hooks, descriptions, captions and hashtags per clip." },
  { icon: Crop, title: "Vertical-first", text: "Every clip is planned for 9:16, with 1:1 and 16:9 options." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6">
        <div className="flex items-center gap-2">
          <Scissors className="size-5 text-primary" />
          <span className="font-semibold tracking-tight">ClipForge Studio</span>
        </div>
        <Button asChild size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-3xl px-4 pb-12 pt-10 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Turn long videos into short clips with AI
        </h1>
        <p className="mt-4 text-base text-muted-foreground sm:text-lg">
          Paste a link to a podcast, livestream or interview. The AI reads the transcript, finds the strongest
          moments and writes the title, hook and captions for each clip.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Get started</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/dashboard">Open workspace</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-16 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="rounded-lg border border-border bg-card p-5">
            <feature.icon className="size-5 text-primary" />
            <h2 className="mt-3 font-medium">{feature.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{feature.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
