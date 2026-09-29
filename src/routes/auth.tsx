import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Scissors } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Iniciar sessão · ClipForge Studio" },
      { name: "description", content: "Inicie sessão para transformar vídeos longos, podcasts e transmissões em clipes verticais curtos." },
      { property: "og:title", content: "Iniciar sessão · ClipForge Studio" },
      { property: "og:description", content: "Aceda ao seu espaço de criação de clipes com IA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPalavra-passe] = useState("");
  const [name, setNome] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard" });
  }, [loading, session, navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/dashboard" });
        } else {
          toast.success("Conta criada. Consulte a sua caixa de entrada para confirmar o e-mail.");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPalavra-passe({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ocorreu um erro.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Não foi possível iniciar sessão com o Google. Tente novamente.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  async function handleReset() {
    if (!email) {
      toast.error("Introduza primeiro o seu e-mail.");
      return;
    }
    const { error } = await supabase.auth.resetPalavra-passeForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) toast.error(error.message);
    else toast.success("E-mail de reposição da palavra-passe enviado.");
  }

  return (
    <div classNome="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div classNome="w-full max-w-md">
        <Link to="/" classNome="mb-6 flex items-center justify-center gap-2 text-foreground">
          <Scissors classNome="size-5 text-primary" />
          <span classNome="text-lg font-semibold tracking-tight">ClipForge Studio</span>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>{mode === "signin" ? "Iniciar sessão" : "Criar a sua conta"}</CardTitle>
            <CardDescription>
              {mode === "signin"
                ? "Aceda aos seus vídeos, clipes e projetos."
                : "Comece a transformar vídeos longos em clipes curtos."}
            </CardDescription>
          </CardHeader>
          <CardContent classNome="space-y-4">
            <Button variant="outline" classNome="w-full" onClick={handleGoogle} disabled={busy}>
              Continuar com o Google
            </Button>
            <div classNome="flex items-center gap-3 text-xs text-muted-foreground">
              <span classNome="h-px flex-1 bg-border" />
              ou
              <span classNome="h-px flex-1 bg-border" />
            </div>
            <form classNome="space-y-4" onSubmit={handleSubmit}>
              {mode === "signup" && (
                <div classNome="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" value={name} onChange={(e) => setNome(e.target.value)} placeholder="O seu nome" />
                </div>
              )}
              <div classNome="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div classNome="space-y-2">
                <Label htmlFor="password">Palavra-passe</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPalavra-passe(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" classNome="w-full" disabled={busy}>
                {mode === "signin" ? "Iniciar sessão" : "Criar conta"}
              </Button>
            </form>
            <div classNome="flex items-center justify-between text-sm">
              <button
                type="button"
                classNome="text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? "Criar uma conta" : "Já tenho uma conta"}
              </button>
              {mode === "signin" && (
                <button
                  type="button"
                  classNome="text-muted-foreground underline-offset-4 hover:underline"
                  onClick={handleReset}
                >
                  Esqueceu-se da palavra-passe?
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
