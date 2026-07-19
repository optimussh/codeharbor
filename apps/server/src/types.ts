export type Role = "admin" | "user";

export interface AuthUser {
  username: string;
  role: Role;
}

export interface SeedUser extends AuthUser {
  passwordHash: string;
  disabled?: boolean;
  dailyQuota?: number | null;
}

export interface HealthStatus {
  server: "ok";
  opencode: "up" | "down";
  llm: "configured" | "missing";
  rag: "up" | "down" | "disabled";
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}
