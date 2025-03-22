import { Handle, Position } from "reactflow";

export default function PromptNode({ data }: any) {
  return (
    <div className="relative bg-white/10 text-white border border-white/20 px-4 py-2 rounded shadow">
      <strong>{data.label || "Prompt"}</strong>

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-white rounded-full"
      />

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-white rounded-full"
      />
    </div>
  );
}
