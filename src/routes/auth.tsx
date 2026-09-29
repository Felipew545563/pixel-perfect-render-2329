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

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.86c2.26-2.09 3.58-5.17 3.58-8.64z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.86-3c-1.08.72-2.45 1.16-4.09 1.16-3.14 0-5.8-2.12-6.75-4.97H1.3v3.1A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.25 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.3a11.98 11.98 0 0 0 0 10.76l3.95-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.3 6.62l3.95 3.1C6.2 6.87 8.86 4.75 12 4.75z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
      <path d="M16.36 12.73c.02 2.61 2.29 3.48 2.32 3.49-.02.06-.37 1.25-1.2 2.47-.72 1.06-1.47 2.11-2.65 2.13-1.16.02-1.53-.69-2.86-.69-1.32 0-1.74.67-2.84.71-1.13.04-1.99-1.14-2.72-2.19-1.49-2.16-2.63-6.1-1.1-8.77.76-1.32 2.12-2.16 3.6-2.18 1.12-.02 2.17.75 2.86.75.68 0 1.97-.93 3.32-.79.56.02 2.15.2 3.17 1.54-.08.05-1.89 1.1-1.87 3.28M14.2 4.12c.61-.74 1.02-1.77.91-2.79-.9.04-1.99.6-2.62 1.34-.57.65-1.06 1.7-.93 2.7 1 .08 1.99-.51 2.64-1.25" />
    </svg>
  );
}

function authErrorMessage(error: unknown): string {

  const message = error instanceof Error ? error.message : "";
  const translations: Record<string, string> = {
    "Invalid login credentials": "O e-mail ou a palavra-passe estão incorretos.",
    "Email not confirmed": "Confirme o seu e-mail antes de iniciar sessão.",
    "User already registered": "Já existe uma conta com este e-mail.",
    "Password should be at least 6 characters": "A palavra-passe deve ter, pelo menos, 6 caracteres.",
    "Unable to validate email address: invalid format": "Introduza um endereço de e-mail válido.",
  };
  return translations[message] ?? "Ocorreu um erro. Tente novamente.";
}

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
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
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleOAuth(provider: "google" | "apple", label: string) {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(`Não foi possível iniciar sessão com ${label}. Tente novamente.`);
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) toast.error(authErrorMessage(error));
    else toast.success("E-mail de reposição da palavra-passe enviado.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 text-foreground">
          <Scissors className="size-5 text-primary" />
          <span className="text-lg font-semibold tracking-tight">ClipForge Studio</span>
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
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleOAuth("google", "o Google")}
                disabled={busy}
              >
                <GoogleMark />
                Continuar com o Google
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleOAuth("apple", "a Apple")}
                disabled={busy}
              >
                <AppleMark />
                Continuar com a Apple
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Use a sua conta iCloud através da Apple.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              ou
              <span className="h-px flex-1 bg-border" />
            </div>
            <form className="space-y-4" onSubmit={handleSubmit}>
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="O seu nome" />
                </div>
              )}
              <div className="space-y-2">
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
              <div className="space-y-2">
                <Label htmlFor="password">Palavra-passe</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {mode === "signin" ? "Iniciar sessão" : "Criar conta"}
              </Button>
            </form>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                className="text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? "Criar uma conta" : "Já tenho uma conta"}
              </button>
              {mode === "signin" && (
                <button
                  type="button"
                  className="text-muted-foreground underline-offset-4 hover:underline"
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
