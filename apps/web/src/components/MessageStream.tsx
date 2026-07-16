import { useChatStore } from "../stores/chatStore";

function formatMessage(m: unknown): string {
  if (!m || typeof m !== "object") return String(m);
  const o = m as Record<string, unknown>;
  if (Array.isArray(o.parts)) {
    return o.parts
      .map((p) => {
        if (p && typeof p === "object" && "text" in p) {
          return String((p as { text: unknown }).text);
        }
        return JSON.stringify(p);
      })
      .join("\n");
  }
  if (o.info && typeof o.info === "object") {
    const info = o.info as Record<string, unknown>;
    const role = String(info.role ?? info.type ?? "");
    const parts = (o.parts as unknown[]) ?? [];
    const text = parts
      .map((p) =>
        p && typeof p === "object" && "text" in p
          ? String((p as { text: unknown }).text)
          : "",
      )
      .join("");
    return `${role}: ${text || JSON.stringify(o).slice(0, 300)}`;
  }
  return JSON.stringify(o).slice(0, 400);
}

export function MessageStream() {
  const messages = useChatStore((s) => s.messages);
  const streamLog = useChatStore((s) => s.streamLog);
  const error = useChatStore((s) => s.error);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {error && (
          <div className="rounded border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm whitespace-pre-wrap text-zinc-200"
          >
            {formatMessage(m)}
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-sm text-zinc-500">
            세션을 만들고 메시지를 보내면 OpenCode 에이전트가 워크스페이스에
            파일을 만듭니다.
          </p>
        )}
      </div>
      <div className="max-h-28 overflow-y-auto border-t border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-[10px] text-zinc-500">
        {streamLog.slice(-30).map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}
