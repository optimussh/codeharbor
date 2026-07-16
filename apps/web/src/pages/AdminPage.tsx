import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type AuthUser, type HealthStatus } from "../api/client";

export function AdminPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [u, a, h] = await Promise.all([
          api.adminUsers(),
          api.adminAudit(100),
          api.health(),
        ]);
        setUsers(u.users);
        setEvents(a.events);
        setHealth(h);
      } catch (e) {
        setError(e instanceof Error ? e.message : "load failed");
      }
    })();
  }, []);

  return (
    <div className="min-h-full bg-zinc-950 p-6 text-zinc-100">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admin</h1>
        <Link to="/" className="text-sm text-indigo-400">
          ← Chat
        </Link>
      </div>

      {error && <p className="mb-4 text-red-400">{error}</p>}

      <section className="mb-6 rounded-xl border border-zinc-800 p-4">
        <h2 className="mb-2 text-sm font-medium text-zinc-300">Health</h2>
        <pre className="text-xs text-zinc-400">
          {JSON.stringify(health, null, 2)}
        </pre>
      </section>

      <section className="mb-6 rounded-xl border border-zinc-800 p-4">
        <h2 className="mb-2 text-sm font-medium text-zinc-300">Users</h2>
        <ul className="space-y-1 text-sm">
          {users.map((u) => (
            <li key={u.username}>
              {u.username}{" "}
              <span className="text-zinc-500">({u.role})</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-800 p-4">
        <h2 className="mb-2 text-sm font-medium text-zinc-300">Audit (tail)</h2>
        <div className="max-h-96 overflow-auto font-mono text-[11px] text-zinc-400">
          {events.map((e, i) => (
            <div key={i} className="border-b border-zinc-900 py-1">
              {JSON.stringify(e)}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
