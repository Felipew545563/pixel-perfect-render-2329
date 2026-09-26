import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Pencil } from "lucide-react";

import { createProject, deleteProject, listProjects, renameProject } from "@/lib/studio.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "Projects · ClipForge Studio" },
      { name: "description", content: "Group your videos and clips by show, client or channel." },
      { property: "og:title", content: "Projects · ClipForge Studio" },
      { property: "og:description", content: "Group your videos and clips by show, client or channel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const fetchProjects = useServerFn(listProjects);
  const addProject = useServerFn(createProject);
  const rename = useServerFn(renameProject);
  const remove = useServerFn(deleteProject);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["projects"], queryFn: () => fetchProjects({}) });
  const [name, setName] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["projects"] });

  const createMutation = useMutation({
    mutationFn: () => addProject({ data: { name } }),
    onSuccess: () => {
      setName("");
      toast.success("Project created");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="text-sm text-muted-foreground">Group videos and clips by show, client or channel.</p>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="space-y-2">
          <Label htmlFor="project-name">New project</Label>
          <div className="flex gap-2">
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Podcast João"
            />
            <Button onClick={() => createMutation.mutate()} disabled={!name.trim() || createMutation.isPending}>
              Create
            </Button>
          </div>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
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
                  const next = window.prompt("New name", project.name);
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
                  if (!window.confirm(`Delete "${project.name}"? Videos stay, they just lose the project.`)) return;
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
