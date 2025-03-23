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

    if (value.length > 450) return;

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

  const hasFinished = data.result !== undefined;
  const isVideoReady = !!data.videoUrl;

  return (
    <div
      className={clsx(
        "relative w-80 rounded border border-white/20 bg-white/10 text-white p-4 shadow transition-all duration-300",
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

      {/* ✅ Conditional rendering area */}
      <div className="mb-2 w-full h-32 rounded border border-white/20 overflow-hidden flex items-center justify-center bg-black/10">
        {hasFinished && data.result != false && !isVideoReady ? (
          // ⏳ Show loading while waiting for video
          <div className="flex items-center text-white/60">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Waiting for recording...
          </div>
        ) : isVideoReady ? (
          // 🎥 Show recorded video
          <video
            src={data.videoUrl}
            controls
            autoPlay
            muted
            className="w-full h-full object-cover"
          />
        ) : data.liveViewUrl ? (
          // 📡 Show live view if still running
          <iframe
            src={data.liveViewUrl}
            title="Live View"
            className="w-full h-full"
            allow="clipboard-read; clipboard-write"
            sandbox="allow-scripts allow-same-origin"
          />
        ) : null}
      </div>

      <textarea
        className="w-full p-2 text-sm bg-white/10 text-white placeholder-white/60 border border-white/20 rounded resize-none focus:outline-none focus:ring-2 focus:ring-white/30"
        placeholder="Enter your prompt..."
        rows={12}
        value={data.prompt || ""}
        onChange={handleChange}
        disabled={data.isRunning}
      />
      <div className="text-right text-xs text-white/50 mt-1">
        {data.prompt?.length || 0}/450 characters
      </div>

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
