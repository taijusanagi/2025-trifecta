import { Handle, Position } from "reactflow";
import clsx from "clsx";

export default function PromptNode({ data }: any) {
  return (
    <div
      className={clsx(
        "relative px-4 py-2 rounded shadow border font-medium transition",
        data.isRunning
          ? "bg-white/20 border-white/40 text-white animate-pulse"
          : "bg-white/10 border-white/20 text-white"
      )}
    >
      {data.label || "Prompt"}

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-white rounded-full"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-white rounded-full"
      />
    </div>
  );
}
