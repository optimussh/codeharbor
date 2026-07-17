import { create } from "zustand";
import { api, type FileNode, type HealthStatus } from "../api/client";

export interface PendingPermission {
  sessionId: string;
  permissionId: string;
  title?: string;
  detail?: string;
}

function sessionIdOf(s: unknown): string {
  if (!s || typeof s !== "object") return "";
  const o = s as Record<string, unknown>;
  if (typeof o.id === "string") return o.id;
  if (typeof o.sessionID === "string") return o.sessionID;
  return "";
}

function sessionTitleOf(s: unknown): string {
  if (!s || typeof s !== "object") return "session";
  const o = s as Record<string, unknown>;
  if (typeof o.title === "string") return o.title;
  return sessionIdOf(s).slice(0, 8) || "session";
}

interface ChatState {
  sessions: unknown[];
  activeSessionId: string | null;
  messages: unknown[];
  health: HealthStatus | null;
  fileTree: FileNode[];
  filePreview: { path: string; content: string } | null;
  pendingPermission: PendingPermission | null;
  streamLog: string[];
  error: string | null;
  es: EventSource | null;

  refreshHealth: () => Promise<void>;
  loadSessions: () => Promise<void>;
  createSession: () => Promise<void>;
  selectSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  connectEvents: () => void;
  disconnectEvents: () => void;
  respondPermission: (response: "once" | "always" | "reject") => Promise<void>;
  loadFiles: () => Promise<void>;
  openFile: (path: string) => Promise<void>;
  pushStream: (line: string) => void;
  messageSearch: string;
  setMessageSearch: (q: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: [],
  health: null,
  fileTree: [],
  filePreview: null,
  pendingPermission: null,
  streamLog: [],
  error: null,
  es: null,
  messageSearch: "",

  setMessageSearch(q: string) {
    set({ messageSearch: q });
  },

  async refreshHealth() {
    try {
      const health = await api.health();
      set({ health });
    } catch {
      set({
        health: { server: "ok", opencode: "down", llm: "missing" },
      });
    }
  },

  async loadSessions() {
    try {
      const sessions = await api.sessions();
      set({ sessions, error: null });
    } catch (e) {
      set({
        sessions: [],
        error: e instanceof Error ? e.message : "Failed to load sessions",
      });
    }
  },

  async createSession() {
    const created = await api.createSession();
    const id = sessionIdOf(created);
    await get().loadSessions();
    if (id) await get().selectSession(id);
  },

  async selectSession(id: string) {
    set({ activeSessionId: id, streamLog: [] });
    try {
      const messages = await api.messages(id);
      set({ messages: Array.isArray(messages) ? messages : [] });
    } catch (e) {
      set({
        messages: [],
        error: e instanceof Error ? e.message : "Failed to load messages",
      });
    }
  },

  async deleteSession(id: string) {
    await api.deleteSession(id);
    if (get().activeSessionId === id) {
      set({ activeSessionId: null, messages: [] });
    }
    await get().loadSessions();
  },

  async renameSession(id: string, title: string) {
    await api.renameSession(id, title);
    await get().loadSessions();
  },

  async sendMessage(text: string) {
    const id = get().activeSessionId;
    if (!id) throw new Error("No active session");
    get().pushStream(`you: ${text}`);
    await api.sendMessage(id, text);
    // refresh after short delay for sync path
    setTimeout(() => {
      void get().selectSession(id);
      void get().loadFiles();
    }, 1500);
  },

  connectEvents() {
    get().disconnectEvents();
    const es = new EventSource("/api/events", { withCredentials: true });
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as {
          type?: string;
          properties?: Record<string, unknown>;
        };
        const type = data.type ?? "event";
        get().pushStream(`${type}`);

        // permission events — shape varies by OpenCode version
        if (
          type.includes("permission") ||
          type === "permission.asked" ||
          type === "permission.updated"
        ) {
          const props = data.properties ?? {};
          const permissionId = String(
            props.id ?? props.permissionID ?? props.permissionId ?? "",
          );
          const sessionId = String(
            props.sessionID ?? props.sessionId ?? get().activeSessionId ?? "",
          );
          if (permissionId) {
            set({
              pendingPermission: {
                sessionId,
                permissionId,
                title: String(props.permission ?? props.type ?? "Permission"),
                detail: JSON.stringify(props).slice(0, 500),
              },
            });
          }
        }

        if (type.includes("message") || type.includes("part")) {
          const id = get().activeSessionId;
          if (id) void get().selectSession(id);
        }
      } catch {
        get().pushStream(ev.data.slice(0, 200));
      }
    };
    es.onerror = () => {
      get().pushStream("sse: reconnecting…");
    };
    set({ es });
  },

  disconnectEvents() {
    const es = get().es;
    if (es) es.close();
    set({ es: null });
  },

  async respondPermission(response) {
    const p = get().pendingPermission;
    if (!p) return;
    await api.respondPermission(p.sessionId, p.permissionId, response);
    set({ pendingPermission: null });
  },

  async loadFiles() {
    try {
      const { tree } = await api.fsTree();
      set({ fileTree: tree });
    } catch {
      set({ fileTree: [] });
    }
  },

  async openFile(path: string) {
    const file = await api.fsContent(path);
    set({ filePreview: file });
  },

  pushStream(line: string) {
    set((s) => ({
      streamLog: [...s.streamLog.slice(-200), line],
    }));
  },
}));

export { sessionIdOf, sessionTitleOf };
