import { Handle, Position, useReactFlow } from "reactflow";
import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import clsx from "clsx";

export default function PromptNode({ data, id }: any) {
  const [opacity, setOpacity] = useState(1);
  const [scale, setScale] = useState(1);
  const { setNodes } = useReactFlow();

  useEffect(() => {
    if (!data.isRunning) {
      setScale(1);
      return;
    }

    setScale(1.05);

    const interval = setInterval(() => {
      setOpacity((prev) => (prev === 1 ? 0.6 : 1));
    }, 500);

    return () => clearInterval(interval);
  }, [data.isRunning]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;

    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                prompt: value,
              },
            }
          : node
      )
    );
  };

  return (
    <div
      className={clsx(
        "relative w-64 rounded border border-white/20 bg-white/10 text-white p-4 shadow transition-all duration-300",
        data.isRunning && "ring-2 ring-white/20"
      )}
      style={{
        opacity: data.isRunning ? opacity : 1,
        transform: `scale(${scale})`,
      }}
    >
      {/* ✅ Status icon */}
      {data.result === true && (
        <CheckCircle className="absolute top-2 right-2 w-5 h-5 text-green-400" />
      )}
      {data.result === false && (
        <XCircle className="absolute top-2 right-2 w-5 h-5 text-red-400" />
      )}
      {data.isRunning && (
        <Loader2 className="absolute top-2 right-2 w-5 h-5 text-white animate-spin" />
      )}

      <div className="font-semibold mb-2 text-white">Task Node</div>

      {data.image && (
        <img
          src={data.image}
          alt="Processing"
          className="w-full h-32 object-cover rounded mb-2 border border-white/20"
        />
      )}

      <textarea
        className="w-full p-2 text-sm bg-white/10 text-white placeholder-white/60 border border-white/20 rounded resize-none focus:outline-none focus:ring-2 focus:ring-white/30"
        placeholder="Enter your prompt..."
        rows={3}
        value={data.prompt || ""}
        onChange={handleChange}
      />

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
