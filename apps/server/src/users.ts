import bcrypt from "bcryptjs";
import type { Role, SeedUser } from "./types.js";
import { config } from "./config.js";

const seedDefs: Array<{ username: string; role: Role; password: string }> = [
  { username: "admin", role: "admin", password: config.passwords.admin },
  { username: "user1", role: "user", password: config.passwords.user1 },
  { username: "user2", role: "user", password: config.passwords.user2 },
];

let users: SeedUser[] | null = null;

export function getUsers(): SeedUser[] {
  if (!users) {
    users = seedDefs.map((u) => ({
      username: u.username,
      role: u.role,
      passwordHash: bcrypt.hashSync(u.password, 10),
    }));
  }
  return users;
}

export function findUser(username: string): SeedUser | undefined {
  return getUsers().find((u) => u.username === username);
}

export function verifyPassword(user: SeedUser, password: string): boolean {
  return bcrypt.compareSync(password, user.passwordHash);
}

export function publicUserList(): Array<{ username: string; role: Role }> {
  return getUsers().map(({ username, role }) => ({ username, role }));
}
