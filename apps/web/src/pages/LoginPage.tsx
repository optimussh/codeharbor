import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export function LoginPage() {
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const [username, setUsername] = useState("user1");
  const [password, setPassword] = useState("user1");

  if (user) return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-full items-center justify-center bg-zinc-950 p-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void login(username, password);
        }}
        className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl"
      >
        <h1 className="text-xl font-semibold text-white">Vibecoding Builder</h1>
        <p className="mt-1 text-sm text-zinc-400">Phase 0 MVP · 로컬 로그인</p>

        <label className="mt-6 block text-xs text-zinc-400">Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />

        <label className="mt-3 block text-xs text-zinc-400">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />

        {error && (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "…" : "Login"}
        </button>

        <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
          admin / admin123 · user1 / user1 · user2 / user2
        </p>
      </form>
    </div>
  );
}
