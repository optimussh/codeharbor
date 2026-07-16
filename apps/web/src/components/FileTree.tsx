import type { FileNode } from "../api/client";
import { useChatStore } from "../stores/chatStore";

function Node({
  node,
  depth,
  onOpen,
}: {
  node: FileNode;
  depth: number;
  onOpen: (path: string) => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (node.type === "file") onOpen(node.path);
        }}
        className={`block w-full truncate text-left text-xs ${
          node.type === "directory" ? "text-zinc-400" : "text-zinc-200 hover:text-indigo-300"
        }`}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        {node.type === "directory" ? "📁 " : "📄 "}
        {node.name}
      </button>
      {node.children?.map((c) => (
        <Node key={c.path} node={c} depth={depth + 1} onOpen={onOpen} />
      ))}
    </div>
  );
}

export function FileTree() {
  const tree = useChatStore((s) => s.fileTree);
  const preview = useChatStore((s) => s.filePreview);
  const openFile = useChatStore((s) => s.openFile);
  const loadFiles = useChatStore((s) => s.loadFiles);

  return (
    <div className="flex h-full flex-col border-l border-zinc-800 bg-zinc-900/40">
      <div className="flex items-center justify-between border-b border-zinc-800 p-3">
        <span className="text-sm font-medium text-zinc-200">Files</span>
        <button
          type="button"
          onClick={() => void loadFiles()}
          className="text-xs text-indigo-400 hover:text-indigo-300"
        >
          Refresh
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {tree.map((n) => (
          <Node key={n.path} node={n} depth={0} onOpen={(p) => void openFile(p)} />
        ))}
        {tree.length === 0 && (
          <p className="px-3 text-xs text-zinc-500">워크스페이스가 비어 있습니다</p>
        )}
      </div>
      {preview && (
        <div className="max-h-48 overflow-auto border-t border-zinc-800 p-2">
          <div className="mb-1 text-[10px] text-zinc-500">{preview.path}</div>
          <pre className="whitespace-pre-wrap text-[11px] text-zinc-300">
            {preview.content}
          </pre>
        </div>
      )}
    </div>
  );
}
