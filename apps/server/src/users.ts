import bcrypt from "bcryptjs";
import type { Role, SeedUser } from "./types.js";
import { config } from "./config.js";

export type AppUser = SeedUser & {
  disabled?: boolean;
  dailyQuota?: number | null;
};

const seedDefs: Array<{ username: string; role: Role; password: string }> = [
  { username: "admin", role: "admin", password: config.passwords.admin },
  { username: "user1", role: "user", password: config.passwords.user1 },
  { username: "user2", role: "user", password: config.passwords.user2 },
];

let users: AppUser[] | null = null;

export function getUsers(): AppUser[] {
  if (!users) {
    users = seedDefs.map((u) => ({
      username: u.username,
      role: u.role,
      passwordHash: bcrypt.hashSync(u.password, 10),
      disabled: false,
      dailyQuota: null,
    }));
  }
  return users;
}

export function findUser(username: string): AppUser | undefined {
  return getUsers().find((u) => u.username === username);
}

export function verifyPassword(user: AppUser, password: string): boolean {
  if (!user.passwordHash) return false;
  return bcrypt.compareSync(password, user.passwordHash);
}

export function publicUserList(): Array<{ username: string; role: Role }> {
  return getUsers().map(({ username, role }) => ({ username, role }));
}

export function createLocalUser(
  username: string,
  password: string,
  role: Role,
): AppUser {
  const u: AppUser = {
    username,
    role,
    passwordHash: bcrypt.hashSync(password, 10),
    disabled: false,
    dailyQuota: null,
  };
  getUsers().push(u);
  return u;
}

/** Upsert OIDC-provisioned user (no password). */
export function ensureOidcUser(
  username: string,
  role: Role,
  displayName?: string,
): AppUser {
  let u = findUser(username);
  if (!u) {
    u = {
      username,
      role,
      passwordHash: bcrypt.hashSync(cryptoRandom(), 10),
      disabled: false,
      dailyQuota: null,
    };
    getUsers().push(u);
  } else if (role === "admin") {
    u.role = "admin";
  }
  void displayName;
  return u;
}

function cryptoRandom(): string {
  return `oidc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function setUserRole(username: string, role: Role): void {
  const u = findUser(username);
  if (u) u.role = role;
}

export function setUserDisabled(username: string, disabled: boolean): void {
  const u = findUser(username);
  if (u) u.disabled = disabled;
}

export function setUserQuota(
  username: string,
  dailyQuota: number | null,
): void {
  const u = findUser(username);
  if (u) u.dailyQuota = dailyQuota;
}
