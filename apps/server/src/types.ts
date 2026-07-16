export type Role = "admin" | "user";

export interface AuthUser {
  username: string;
  role: Role;
}

export interface SeedUser extends AuthUser {
  passwordHash: string;
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
