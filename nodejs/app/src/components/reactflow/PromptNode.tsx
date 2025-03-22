import { Handle, Position } from "reactflow";
import clsx from "clsx";
import { useEffect, useState } from "react";

export default function PromptNode({ data }: any) {
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    if (!data.isRunning) return;
    const interval = setInterval(() => {
      setOpacity((prev) => (prev === 1 ? 0.6 : 1));
    }, 500);

    return () => clearInterval(interval);
  }, [data.isRunning]);

  return (
    <div
      className={
        "relative px-4 py-2 rounded shadow border font-medium transition-all duration-500 ease-in-out bg-white/10 border-white/20 text-white"
      }
      style={{ opacity: data.isRunning ? opacity : 1 }}
    >
      {data.label || "Prompt Node"}

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
