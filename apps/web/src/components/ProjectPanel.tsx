import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { useChatStore } from "../stores/chatStore";
import { GATEWAY_URL } from "../gateway";

type Project = {
  id: string;
  slug: string;
  name: string;
  myRole: string;
};

export function ProjectPanel() {
  const projectId = useChatStore((s) => s.projectId);
  const projectLabel = useChatStore((s) => s.projectLabel);
  const setProject = useChatStore((s) => s.setProject);
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [skills, setSkills] = useState<
    Array<{ id: string; name: string; description: string }>
  >([]);
  const [msg, setMsg] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [p, t, s] = await Promise.all([
        api.projects(),
        api.templates(),
        api.skills(),
      ]);
      setProjects(p.projects);
      setTemplates(t.templates);
      setSkills(s.skills);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "load failed");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="flex h-full flex-col gap-2 overflow-auto p-2 text-xs text-zinc-300">
      <div className="font-semibold text-zinc-100">Workspace</div>
      <select
        className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
        value={projectId ?? ""}
        onChange={(e) => {
          const id = e.target.value || null;
          if (!id) {
            setProject(null, "Personal");
            return;
          }
          const p = projects.find((x) => x.id === id);
          setProject(id, p?.name ?? id);
        }}
      >
        <option value="">Personal</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.myRole})
          </option>
        ))}
      </select>
      <div className="text-[10px] text-zinc-500">Active: {projectLabel}</div>

      <div className="mt-2 flex gap-1">
        <input
          className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
          placeholder="New project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="button"
          className="rounded bg-indigo-600 px-2 py-1 text-white"
          onClick={() => {
            if (!name.trim()) return;
            void api.createProject(name.trim()).then(() => {
              setName("");
              void refresh();
            });
          }}
        >
          +
        </button>
      </div>

      {projectId && (
        <button
          type="button"
          className="rounded border border-zinc-600 px-2 py-1 text-indigo-300"
          onClick={() => {
            void api.projectBind(projectId).then((b) => {
              const url = b.chamberPath?.startsWith("/")
                ? `${GATEWAY_URL}${b.chamberPath}`
                : b.chamberUrl;
              window.open(url, "_blank", "noopener,noreferrer");
            });
          }}
        >
          Open Chamber (project)
        </button>
      )}

      <div className="mt-3 font-semibold text-zinc-100">Templates</div>
      {templates.map((t) => (
        <button
          key={t.id}
          type="button"
          className="rounded border border-zinc-700 px-2 py-1 text-left hover:border-indigo-500"
          onClick={() => {
            void api.applyTemplate(t.id, projectId).then(() => {
              setMsg(`Applied ${t.id}`);
              void useChatStore.getState().loadFiles();
            });
          }}
        >
          {t.name}
        </button>
      ))}

      <div className="mt-3 font-semibold text-zinc-100">Skills</div>
      {skills.map((s) => (
        <button
          key={s.id}
          type="button"
          title={s.description}
          className="rounded border border-zinc-700 px-2 py-1 text-left hover:border-emerald-600"
          onClick={() => {
            void api.applySkill(s.id, projectId).then(() => {
              setMsg(`Skill ${s.id} applied`);
              void useChatStore.getState().loadFiles();
            });
          }}
        >
          {s.name}
        </button>
      ))}

      {msg && <div className="text-[10px] text-emerald-400">{msg}</div>}
    </div>
  );
}
