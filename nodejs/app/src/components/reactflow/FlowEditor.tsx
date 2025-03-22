import {
  ReactFlow,
  Background,
  Controls,
  useReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
} from "reactflow";
import { useCallback, useEffect, useState } from "react";

import StartNode from "./StartNode";
import PromptNode from "./PromptNode";

const nodeTypes = {
  start: StartNode,
  prompt: PromptNode,
};

export default function FlowEditor() {
  const initialNodes: Node[] = [
    {
      id: "start",
      type: "start",
      position: { x: 100, y: 100 },
      data: { label: "Start Node" },
      deletable: false,
    },
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { project } = useReactFlow();
  const [isRunning, setIsRunning] = useState(false);

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      if (isRunning) return; // Prevent drop while running

      event.preventDefault();
      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const type = event.dataTransfer.getData("application/reactflow");
      const label = event.dataTransfer.getData("text/prompt");

      if (!type) return;

      if (type === "start") {
        const hasStart = nodes.some((n) => n.type === "start");
        if (hasStart) return;
      }

      if (type === "prompt") {
        const promptCount = nodes.filter((n) => n.type === "prompt").length;
        if (promptCount >= 5) {
          alert("You can only add up to 5 prompt nodes.");
          return;
        }
      }

      const position = project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNode: Node = {
        id: `${+new Date()}`,
        type,
        position,
        data: { label },
        deletable: !isRunning,
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [project, nodes, isRunning]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const runFlow = async () => {
    setIsRunning(true);
    const visited = new Set<string>();

    setNodes((nds) => nds.map((n) => ({ ...n, deletable: false })));

    const runNode = async (id: string) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, isRunning: true } }
            : node
        )
      );

      await new Promise((res) => setTimeout(res, 1000));

      setNodes((nds) =>
        nds.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, isRunning: false } }
            : node
        )
      );

      visited.add(id);

      const nextEdges = edges.filter((e) => e.source === id);
      for (const edge of nextEdges) {
        if (!visited.has(edge.target)) {
          await runNode(edge.target);
        }
      }
    };

    await runNode("start");

    setNodes((nds) => nds.map((n) => ({ ...n, deletable: n.id !== "start" })));
    setIsRunning(false);
  };

  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === "start"
          ? {
              ...n,
              data: {
                ...n.data,
                onRun: runFlow,
              },
            }
          : n
      )
    );
  }, [edges]);

  return (
    <ReactFlow
      nodeTypes={nodeTypes}
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onDrop={onDrop}
      onDragOver={onDragOver}
      fitView
      className="w-full h-full"
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <Controls />
    </ReactFlow>
  );
}
