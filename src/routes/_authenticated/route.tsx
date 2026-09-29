import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  Sparkles,
  Film,
  Scissors,
  LogOut,
  Gauge,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { OnboardingTour, TOUR_STORAGE_KEY, TutorialButton } from "@/components/OnboardingTour";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const NAV = [
  { to: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { to: "/create", label: "Criar clipes", icon: Sparkles },
  { to: "/videos", label: "Vídeos", icon: Film },
  { to: "/clips", label: "Os meus clipes", icon: Scissors },
  { to: "/projects", label: "Projetos", icon: FolderKanban },
  { to: "/usage", label: "Utilização", icon: Gauge },
] as const;

function AuthenticatedLayout() {
  const { session, loading, user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [tourOpen, setTourOpen] = useState(false);
  const [tourChecked, setTourChecked] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
    if (!loading && session && !tourChecked) {
      setTourChecked(true);
      try {
        if (!localStorage.getItem(TOUR_STORAGE_KEY)) setTourOpen(true);
      } catch {
        // storage unavailable — don't block the app
      }
    }
  }, [loading, session, navigate, tourChecked]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        A carregar o seu espaço de trabalho…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <aside className="border-b border-border bg-card lg:min-h-screen lg:w-60 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 px-4 py-4">
          <Scissors className="size-5 text-primary" />
          <span className="font-semibold tracking-tight">ClipForge</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 lg:flex-col lg:overflow-visible">
          {NAV.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden px-4 py-4 lg:block">
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          <TutorialButton onClick={() => setTourOpen(true)} />
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start px-2"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut className="mr-2 size-4" /> Terminar sessão
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">
        <Outlet />
      </main>
      <OnboardingTour open={tourOpen} onOpenChange={setTourOpen} />
    </div>
  );
}
