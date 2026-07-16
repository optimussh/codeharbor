import type { HealthStatus } from "../api/client";

export function StatusBar({ health }: { health: HealthStatus | null }) {
  const oc = health?.opencode ?? "down";
  const llm = health?.llm ?? "missing";
  return (
    <div className="flex items-center gap-4 border-t border-zinc-800 bg-zinc-900/80 px-4 py-2 text-xs text-zinc-400">
      <span>
        OpenCode:{" "}
        <span className={oc === "up" ? "text-emerald-400" : "text-red-400"}>
          {oc}
        </span>
      </span>
      <span>
        LLM:{" "}
        <span
          className={llm === "configured" ? "text-emerald-400" : "text-amber-400"}
        >
          {llm}
        </span>
      </span>
      {oc === "down" && (
        <span className="text-amber-300">
          OpenCode 미기동 — `npm i -g opencode-ai` 후 서버 재시작
        </span>
      )}
      {llm === "missing" && (
        <span className="text-amber-300">.env 에 GEMINI_API_KEY 설정 필요</span>
      )}
    </div>
  );
}
