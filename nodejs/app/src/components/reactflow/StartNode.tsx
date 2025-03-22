import { Handle, Position } from "reactflow";
import { Play, Loader2 } from "lucide-react";
import clsx from "clsx";

export default function StartNode({ data }: any) {
  return (
    <div
      className={clsx(
        "relative rounded-lg px-4 py-2 shadow flex items-center gap-2 border transition",
        "bg-green-600 border-white/20"
      )}
    >
      <button
        onClick={data.onRun}
        disabled={data.isRunning}
        className="p-1 rounded hover:bg-white/10 cursor-pointer disabled:cursor-not-allowed"
      >
        {data.isRunning ? (
          <Loader2 className="w-4 h-4 animate-spin text-white" />
        ) : (
          <Play className="w-4 h-4 text-white" />
        )}
      </button>

      <span>{data.label || "Start"}</span>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-white rounded-full"
      />
    </div>
  );
}
