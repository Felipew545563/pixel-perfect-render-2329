import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getOverview } from "@/lib/studio.functions";

export const Route = createFileRoute("/_authenticated/usage")({
  head: () => ({
    meta: [
      { title: "Usage · ClipForge Studio" },
      { name: "description", content: "Processing minutes left, clips generated and current plan." },
      { property: "og:title", content: "Usage · ClipForge Studio" },
      { property: "og:description", content: "Processing minutes left, clips generated and current plan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UsagePage,
});

const PLANS = [
  { name: "Free", detail: "120 processing minutes, up to 5 clips per video." },
  { name: "Creator", detail: "More minutes, up to 10 clips per video, no watermark." },
  { name: "Pro", detail: "Advanced detection, up to 20 clips per video, templates." },
  { name: "Business", detail: "Highest limits, multiple seats, priority processing." },
];

function UsagePage() {
  const fetchOverview = useServerFn(getOverview);
  const { data, isLoading } = useQuery({ queryKey: ["overview"], queryFn: () => fetchOverview({}) });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usage & plan</h1>
        <p className="text-sm text-muted-foreground">Each analysis uses processing minutes based on video length.</p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {data && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Minutes left", data.profile?.credits_minutes ?? 0],
            ["Minutes used", data.totals.minutesUsed],
            ["Clips this month", data.totals.clipsThisMonth],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value as number}</p>
            </div>
          ))}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="font-medium">Plans</h2>
        <p className="text-sm text-muted-foreground">
          Everyone is on the Free plan for now. Paid plans and checkout are not connected yet.
        </p>
        <ul className="grid gap-2">
          {PLANS.map((plan) => (
            <li key={plan.name} className="rounded-lg border border-border bg-card p-3">
              <p className="font-medium">{plan.name}</p>
              <p className="text-sm text-muted-foreground">{plan.detail}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
