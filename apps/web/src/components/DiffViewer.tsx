import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { useChatStore } from "../stores/chatStore";

function colorizeDiff(diff: string): ReactNode[] {
  return diff.split("\n").map((line, i) => {
    let cls = "text-zinc-400";
    if (line.startsWith("+") && !line.startsWith("+++")) cls = "text-emerald-400";
    else if (line.startsWith("-") && !line.startsWith("---")) cls = "text-red-400";
    else if (line.startsWith("@@")) cls = "text-cyan-400";
    else if (line.startsWith("diff ") || line.startsWith("index "))
      cls = "text-zinc-500";
    return (
      <div key={i} className={cls}>
        {line || " "}
      </div>
    );
  });
}

export function DiffViewer() {
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"git" | "session">("git");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (tab === "git") {
        const d = await api.gitDiff(false);
        setText(d.diff || "(no unstaged changes)");
      } else if (activeSessionId) {
        const raw = await api.sessionDiff(activeSessionId);
        setText(
          typeof raw === "string"
            ? raw
            : JSON.stringify(raw, null, 2),
        );
      } else {
        setText("(select a session)");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "diff failed");
      setText("");
    } finally {
      setBusy(false);
    }
  }, [tab, activeSessionId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-14 right-4 z-40 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 shadow-lg hover:border-indigo-500"
      >
        Diff
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setTab("git")}
              className={`rounded px-2 py-1 ${tab === "git" ? "bg-indigo-600 text-white" : "text-zinc-400"}`}
            >
              Git working tree
            </button>
            <button
              type="button"
              onClick={() => setTab("session")}
              className={`rounded px-2 py-1 ${tab === "session" ? "bg-indigo-600 text-white" : "text-zinc-400"}`}
            >
              Session diff
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={busy}
              className="text-zinc-500 hover:text-zinc-300"
            >
              Refresh
            </button>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-zinc-400 hover:text-white"
          >
            Close
          </button>
        </div>
        {error && (
          <div className="border-b border-red-900 bg-red-950/40 px-4 py-2 text-xs text-red-300">
            {error}
          </div>
        )}
        <pre className="flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed">
          {busy ? "Loading…" : colorizeDiff(text)}
        </pre>
      </div>
    </div>
  );
}
