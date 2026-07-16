import { useChatStore } from "../stores/chatStore";

export function PermissionCard() {
  const pending = useChatStore((s) => s.pendingPermission);
  const respond = useChatStore((s) => s.respondPermission);

  if (!pending) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-amber-700/50 bg-zinc-900 p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-amber-200">권한 요청</h2>
        <p className="mt-2 text-sm text-zinc-300">{pending.title}</p>
        {pending.detail && (
          <pre className="mt-3 max-h-40 overflow-auto rounded bg-zinc-950 p-2 text-[11px] text-zinc-400">
            {pending.detail}
          </pre>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => void respond("reject")}
            className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Deny
          </button>
          <button
            type="button"
            onClick={() => void respond("once")}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}
