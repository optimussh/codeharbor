import { useCallback, useEffect, useState } from "react";
import { api, type RagDocument, type RagHit } from "../api/client";

export function RagPanel() {
  const [docs, setDocs] = useState<RagDocument[]>([]);
  const [status, setStatus] = useState<string>("…");
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<RagHit[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const st = await api.ragStatus();
      setStatus(`${st.rag} / embed=${st.embedding.mode}`);
      if (st.rag === "up") {
        const { documents } = await api.ragDocuments();
        setDocs(documents);
      } else {
        setDocs([]);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "RAG error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onUpload(file: File) {
    setBusy(true);
    setError(null);
    try {
      await api.ragUpload(file);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    try {
      const { hits: h } = await api.ragSearch(query.trim());
      setHits(h);
    } catch (err) {
      setError(err instanceof Error ? err.message : "search failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col border-l border-zinc-800 bg-zinc-900/50">
      <div className="border-b border-zinc-800 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-200">RAG Docs</span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="text-xs text-indigo-400"
          >
            Refresh
          </button>
        </div>
        <p className="mt-1 text-[10px] text-zinc-500">status: {status}</p>
      </div>

      <div className="space-y-2 border-b border-zinc-800 p-3">
        <label className="block cursor-pointer rounded-lg border border-dashed border-zinc-700 px-3 py-2 text-center text-xs text-zinc-400 hover:border-indigo-500 hover:text-indigo-300">
          {busy ? "…" : "Upload .txt / .md / .csv"}
          <input
            type="file"
            accept=".txt,.md,.markdown,.csv,.json,.ts,.tsx,.js,.py"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUpload(f);
              e.target.value = "";
            }}
          />
        </label>
        {error && <p className="text-[11px] text-red-400">{error}</p>}
      </div>

      <ul className="max-h-40 overflow-y-auto border-b border-zinc-800 p-2 text-xs">
        {docs.map((d) => (
          <li
            key={d.id}
            className="mb-1 flex items-start justify-between gap-1 rounded px-1 py-1 hover:bg-zinc-800/80"
          >
            <span className="min-w-0 flex-1 truncate text-zinc-300" title={d.filename}>
              {d.filename}
              <span className="block text-[10px] text-zinc-600">
                {d.chunk_count ?? "?"} chunks
              </span>
            </span>
            <button
              type="button"
              className="text-zinc-500 hover:text-red-400"
              onClick={() =>
                void api.ragDelete(d.id).then(() => refresh())
              }
            >
              ×
            </button>
          </li>
        ))}
        {docs.length === 0 && (
          <li className="px-1 text-zinc-600">문서 없음</li>
        )}
      </ul>

      <form onSubmit={(e) => void onSearch(e)} className="border-b border-zinc-800 p-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="검색…"
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
        />
      </form>

      <div className="flex-1 overflow-y-auto p-2 text-[11px] text-zinc-400">
        {hits.map((h) => (
          <div
            key={h.chunkId}
            className="mb-2 rounded border border-zinc-800 bg-zinc-950/60 p-2"
          >
            <div className="mb-1 text-[10px] text-indigo-400">
              {h.filename} · {h.score.toFixed(3)}
            </div>
            <pre className="whitespace-pre-wrap font-sans text-zinc-300">
              {h.content.slice(0, 400)}
              {h.content.length > 400 ? "…" : ""}
            </pre>
          </div>
        ))}
        {hits.length === 0 && (
          <p className="text-zinc-600">
            채팅 전송 시 자동으로 문서 근거가 주입됩니다.
          </p>
        )}
      </div>
    </div>
  );
}
