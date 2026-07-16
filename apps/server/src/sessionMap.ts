const ownership = new Map<string, string>();

export function claim(sessionId: string, username: string): void {
  ownership.set(sessionId, username);
}

export function release(sessionId: string): void {
  ownership.delete(sessionId);
}

export function ownerOf(sessionId: string): string | undefined {
  return ownership.get(sessionId);
}

export function listByUser(username: string): string[] {
  return [...ownership.entries()]
    .filter(([, user]) => user === username)
    .map(([id]) => id);
}

export function assertOwner(sessionId: string, username: string): boolean {
  return ownership.get(sessionId) === username;
}

/** Test helper */
export function clearAll(): void {
  ownership.clear();
}
