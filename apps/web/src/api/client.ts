export type Role = "admin" | "user";

export interface AuthUser {
  username: string;
  role: Role;
}

export interface HealthStatus {
  server: "ok";
  opencode: "up" | "down";
  llm: "configured" | "missing";
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `HTTP ${res.status}`,
    );
  }
  return data as T;
}

export const api = {
  login(username: string, password: string) {
    return request<AuthUser>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  },
  logout() {
    return request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
  },
  me() {
    return request<AuthUser>("/api/auth/me");
  },
  health() {
    return request<HealthStatus>("/api/health");
  },
  sessions() {
    return request<unknown[]>("/api/sessions");
  },
  createSession(title?: string) {
    return request<Record<string, unknown>>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
  },
  deleteSession(id: string) {
    return request<{ ok: boolean }>(`/api/sessions/${id}`, {
      method: "DELETE",
    });
  },
  messages(id: string) {
    return request<unknown[]>(`/api/sessions/${id}/messages`);
  },
  sendMessage(id: string, text: string) {
    return request<unknown>(`/api/sessions/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  },
  abort(id: string) {
    return request<{ ok: boolean }>(`/api/sessions/${id}/abort`, {
      method: "POST",
    });
  },
  respondPermission(
    sessionId: string,
    permissionId: string,
    response: "once" | "always" | "reject",
  ) {
    return request<{ ok: boolean }>(
      `/api/sessions/${sessionId}/permissions/${permissionId}`,
      {
        method: "POST",
        body: JSON.stringify({ response }),
      },
    );
  },
  fsTree() {
    return request<{ root: string; tree: FileNode[] }>("/api/fs");
  },
  fsContent(path: string) {
    return request<{ path: string; content: string }>(
      `/api/fs/content?path=${encodeURIComponent(path)}`,
    );
  },
  adminUsers() {
    return request<{ users: AuthUser[] }>("/api/admin/users");
  },
  adminAudit(limit = 100) {
    return request<{ events: Array<Record<string, unknown>> }>(
      `/api/admin/audit?limit=${limit}`,
    );
  },
};
