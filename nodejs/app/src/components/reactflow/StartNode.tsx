import { Handle, Position } from "reactflow";
import { Play } from "lucide-react";

export default function StartNode({ data }: any) {
  return (
    <div className="relative bg-green-600 text-white rounded-lg px-4 py-2 shadow flex items-center gap-2">
      <Play className="w-4 h-4" />
      <span>{data.label || "Start"}</span>

      {/* Only output handle (start node has no input) */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-white rounded-full"
      />
    </div>
  );
}
