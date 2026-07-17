import { useState } from "react";
import {
  sessionIdOf,
  sessionTitleOf,
  useChatStore,
} from "../stores/chatStore";

export function SessionList() {
  const sessions = useChatStore((s) => s.sessions);
  const active = useChatStore((s) => s.activeSessionId);
  const createSession = useChatStore((s) => s.createSession);
  const selectSession = useChatStore((s) => s.selectSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const renameSession = useChatStore((s) => s.renameSession);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  return (
    <div className="flex h-full flex-col border-r border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center justify-between border-b border-zinc-800 p-3">
        <span className="text-sm font-medium text-zinc-200">Sessions</span>
        <button
          type="button"
          onClick={() => void createSession()}
          className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-500"
        >
          + New
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto p-2">
        {sessions.map((s) => {
          const id = sessionIdOf(s);
          const title = sessionTitleOf(s);
          const isEdit = editingId === id;
          return (
            <li key={id} className="mb-1 flex items-center gap-1">
              {isEdit ? (
                <form
                  className="flex flex-1 gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const t = editTitle.trim();
                    if (t) void renameSession(id, t);
                    setEditingId(null);
                  }}
                >
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => setEditingId(null)}
                    className="min-w-0 flex-1 rounded border border-zinc-600 bg-zinc-950 px-1.5 py-1 text-xs text-zinc-100"
                  />
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => void selectSession(id)}
                  onDoubleClick={() => {
                    setEditingId(id);
                    setEditTitle(title);
                  }}
                  title="더블클릭: 이름 수정"
                  className={`flex-1 truncate rounded px-2 py-1.5 text-left text-sm ${
                    active === id
                      ? "bg-indigo-600/30 text-indigo-100"
                      : "text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  {title}
                </button>
              )}
              <button
                type="button"
                title="Rename"
                onClick={() => {
                  setEditingId(id);
                  setEditTitle(title);
                }}
                className="px-0.5 text-xs text-zinc-600 hover:text-zinc-300"
              >
                ✎
              </button>
              <button
                type="button"
                title="Delete"
                onClick={() => void deleteSession(id)}
                className="px-1 text-zinc-500 hover:text-red-400"
              >
                ×
              </button>
            </li>
          );
        })}
        {sessions.length === 0 && (
          <li className="p-2 text-xs text-zinc-500">세션이 없습니다. + New</li>
        )}
      </ul>
    </div>
  );
}
