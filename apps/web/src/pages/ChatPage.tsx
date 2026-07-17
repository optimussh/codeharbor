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
import { GitPanel } from "../components/GitPanel";
import { StatusBar } from "../components/StatusBar";
import { PermissionCard } from "../components/PermissionCard";
import { DiffViewer } from "../components/DiffViewer";
import { ResizeHandle } from "../components/ResizeHandle";
import { usePanelWidths } from "../hooks/usePanelWidths";

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
  const { widths, setPanel, adjustPanel, reset } = usePanelWidths();

  const createSession = useChatStore((s) => s.createSession);
  const sessions = useChatStore((s) => s.sessions);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const [autoSessionTried, setAutoSessionTried] = useState(false);

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

  // Auto-open first chat session so the composer is usable after login
  useEffect(() => {
    if (autoSessionTried) return;
    if (activeSessionId) {
      setAutoSessionTried(true);
      return;
    }
    if (sessions.length > 0) {
      setAutoSessionTried(true);
      return;
    }
    setAutoSessionTried(true);
    void createSession().catch(() => {
      // OpenCode down — StatusBar already shows it
    });
  }, [sessions, activeSessionId, autoSessionTried, createSession]);

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
          <a
            href="http://127.0.0.1:3000/chamber/"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-indigo-400 hover:text-indigo-300"
            title="게이트웨이 서브패스 /chamber/ (로그인 필요)"
          >
            Chamber
          </a>
          <button
            type="button"
            onClick={() =>
              void api.previewStart().then((p) => {
                window.open(p.url || p.direct, "_blank");
              })
            }
            className="text-xs text-emerald-400 hover:text-emerald-300"
            title="워크스페이스 앱 미리보기"
          >
            Preview
          </button>
          <button
            type="button"
            onClick={reset}
            title="패널 너비 기본값으로 초기화"
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            레이아웃
          </button>
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

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sessions */}
        <div
          className="min-h-0 shrink-0 overflow-hidden"
          style={{ width: widths.sessions }}
        >
          <SessionList />
        </div>

        <ResizeHandle
          onResize={(dx) => adjustPanel("sessions", dx)}
          onDoubleClick={() => setPanel("sessions", 200)}
          title="세션 패널 너비 · 드래그 조절 · 더블클릭 기본값"
        />

        {/* Chat (fills remaining space) */}
        <div className="flex min-h-0 min-w-[240px] flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1">
            <MessageStream />
          </div>
          <Composer />
          <GitPanel />
        </div>

        <ResizeHandle
          onResize={(dx) => adjustPanel("files", -dx)}
          onDoubleClick={() => setPanel("files", 220)}
          title="파일 패널 너비 · 드래그 조절 · 더블클릭 기본값"
        />

        {/* Files */}
        <div
          className="min-h-0 shrink-0 overflow-hidden"
          style={{ width: widths.files }}
        >
          <FileTree />
        </div>

        <ResizeHandle
          onResize={(dx) => adjustPanel("rag", -dx)}
          onDoubleClick={() => setPanel("rag", 240)}
          title="RAG 패널 너비 · 드래그 조절 · 더블클릭 기본값"
        />

        {/* RAG */}
        <div
          className="min-h-0 shrink-0 overflow-hidden"
          style={{ width: widths.rag }}
        >
          <RagPanel />
        </div>
      </div>

      <StatusBar health={health} />
      <PermissionCard />
      <DiffViewer />
    </div>
  );
}
