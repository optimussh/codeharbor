import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useChatStore } from "../stores/chatStore";
import { api } from "../api/client";
import { SessionList } from "../components/SessionList";
import { MessageStream } from "../components/MessageStream";
import { Composer } from "../components/Composer";
import { FileTree } from "../components/FileTree";
import { RagPanel } from "../components/RagPanel";
import { StatusBar } from "../components/StatusBar";
import { PermissionCard } from "../components/PermissionCard";

export function ChatPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const health = useChatStore((s) => s.health);
  const refreshHealth = useChatStore((s) => s.refreshHealth);
  const loadSessions = useChatStore((s) => s.loadSessions);
  const loadFiles = useChatStore((s) => s.loadFiles);
  const connectEvents = useChatStore((s) => s.connectEvents);
  const disconnectEvents = useChatStore((s) => s.disconnectEvents);
  const [workspacePath, setWorkspacePath] = useState<string>("");

  useEffect(() => {
    void refreshHealth();
    void loadSessions();
    void loadFiles();
    connectEvents();
    void api
      .workspace()
      .then((w) => setWorkspacePath(w.path))
      .catch(() => setWorkspacePath(""));
    const t = setInterval(() => void refreshHealth(), 10000);
    return () => {
      clearInterval(t);
      disconnectEvents();
    };
  }, [
    refreshHealth,
    loadSessions,
    loadFiles,
    connectEvents,
    disconnectEvents,
  ]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 font-semibold text-white">
            Vibecoding Builder
          </span>
          <span className="shrink-0 text-xs text-zinc-500">
            {user?.username} ({user?.role})
          </span>
          {workspacePath && (
            <span
              className="truncate text-[11px] text-zinc-600"
              title={workspacePath}
            >
              ws: {workspacePath}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          {user?.role === "admin" && (
            <Link to="/admin" className="text-indigo-400 hover:text-indigo-300">
              Admin
            </Link>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            className="text-zinc-400 hover:text-zinc-200"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[200px_1fr_220px_240px]">
        <SessionList />
        <div className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1">
            <MessageStream />
          </div>
          <Composer />
        </div>
        <FileTree />
        <RagPanel />
      </div>

      <StatusBar health={health} />
      <PermissionCard />
    </div>
  );
}
