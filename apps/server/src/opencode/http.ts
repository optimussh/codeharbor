import { config } from "../config.js";

/** Build OpenCode URL with required directory query (project isolation). */
export function opencodeUrl(
  pathname: string,
  directory?: string,
  extraQuery?: Record<string, string>,
): string {
  const base = config.opencodeBaseUrl.replace(/\/$/, "");
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const u = new URL(`${base}${path}`);
  if (directory) u.searchParams.set("directory", directory);
  if (extraQuery) {
    for (const [k, v] of Object.entries(extraQuery)) {
      u.searchParams.set(k, v);
    }
  }
  return u.toString();
}

export async function opencodeFetch(
  pathname: string,
  init: RequestInit & { directory?: string } = {},
): Promise<Response> {
  const { directory, ...rest } = init;
  return fetch(opencodeUrl(pathname, directory), {
    ...rest,
    signal: rest.signal ?? AbortSignal.timeout(60_000),
  });
}

export function parseJsonBody(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

export function sessionIdOf(s: unknown): string | undefined {
  if (!s || typeof s !== "object") return undefined;
  const o = s as Record<string, unknown>;
  if (typeof o.id === "string") return o.id;
  if (typeof o.sessionID === "string") return o.sessionID;
  return undefined;
}

export function directoryOf(s: unknown): string | undefined {
  if (!s || typeof s !== "object") return undefined;
  const o = s as Record<string, unknown>;
  if (typeof o.directory === "string") return o.directory;
  return undefined;
}
