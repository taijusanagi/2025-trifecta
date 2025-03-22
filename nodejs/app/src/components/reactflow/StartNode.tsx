import { Handle, Position } from "reactflow";
import { Play } from "lucide-react";
import clsx from "clsx";

export default function StartNode({ data }: any) {
  return (
    <div
      className={clsx(
        "relative rounded-lg px-4 py-2 shadow flex items-center gap-2 border transition",
        data.isRunning
          ? "bg-green-700 border-white/40 animate-pulse"
          : "bg-green-600 border-white/20"
      )}
    >
      <Play className="w-4 h-4" />
      <span>{data.label || "Start"}</span>

      {/* Optional: Run button inside node */}
      {data.onRun && (
        <button
          onClick={data.onRun}
          className="ml-2 px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded"
        >
          Run
        </button>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-white rounded-full"
      />
    </div>
  );
}
