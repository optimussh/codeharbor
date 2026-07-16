import { useState } from "react";
import { useChatStore } from "../stores/chatStore";

export function Composer() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useChatStore((s) => s.activeSessionId);
  const sendMessage = useChatStore((s) => s.sendMessage);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !active) return;
    setBusy(true);
    try {
      await sendMessage(text.trim());
      setText("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="flex gap-2 border-t border-zinc-800 bg-zinc-900 p-3"
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={!active || busy}
        placeholder={
          active
            ? "자연어로 지시하세요… 예: hello.txt 만들어줘"
            : "먼저 세션을 만드세요"
        }
        className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={!active || busy || !text.trim()}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
      >
        Send
      </button>
    </form>
  );
}
