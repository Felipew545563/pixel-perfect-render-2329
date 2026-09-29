import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Pencil } from "lucide-react";

import { createProject, deleteProject, listProjetos, renameProject } from "@/lib/studio.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "Projetos · ClipForge Studio" },
      { name: "description", content: "Organize os seus vídeos e clipes por programa, cliente ou canal." },
      { property: "og:title", content: "Projetos · ClipForge Studio" },
      { property: "og:description", content: "Organize os seus vídeos e clipes por programa, cliente ou canal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjetosPage,
});

function ProjetosPage() {
  const fetchProjetos = useServerFn(listProjetos);
  const addProject = useServerFn(createProject);
  const rename = useServerFn(renameProject);
  const remove = useServerFn(deleteProject);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["projects"], queryFn: () => fetchProjetos({}) });
  const [name, setName] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["projects"] });

  const createMutation = useMutation({
    mutationFn: () => addProject({ data: { name } }),
    onSuccess: () => {
      setName("");
      toast.success("Projeto criado");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Projetos</h1>
        <p className="text-sm text-muted-foreground">Organize vídeos e clipes por programa, cliente ou canal.</p>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="space-y-2">
          <Label htmlFor="project-name">Novo projeto</Label>
          <div className="flex gap-2">
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Podcast João"
            />
            <Button onClick={() => createMutation.mutate()} disabled={!name.trim() || createMutation.isPending}>
              Criar
            </Button>
          </div>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">A carregar…</p>}
      <ul className="space-y-2">
        {(data ?? []).map((project) => (
          <li
            key={project.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
          >
            <span className="min-w-0 truncate">{project.name}</span>
            <div className="flex shrink-0 gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  const next = window.prompt("Novo nome", project.name);
                  if (!next?.trim()) return;
                  await rename({ data: { id: project.id, name: next.trim() } });
                  invalidate();
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  if (!window.confirm(`Eliminar "${project.name}"? Os vídeos serão mantidos, mas deixarão de estar associados ao projeto.`)) return;
                  await remove({ data: { id: project.id } });
                  invalidate();
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
