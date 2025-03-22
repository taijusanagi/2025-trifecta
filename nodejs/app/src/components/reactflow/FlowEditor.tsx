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
  OnConnectStartParams,
} from "reactflow";
import { useCallback, useEffect, useRef, useState } from "react";

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

  const connectingNodeId = useRef<string | null>(null);

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  const onConnectStart = useCallback((_: any, params: OnConnectStartParams) => {
    connectingNodeId.current = params.nodeId || null;
  }, []);

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement;
      const reactFlowBounds = (
        document.querySelector(".react-flow") as HTMLDivElement
      )?.getBoundingClientRect();

      if (
        target?.classList.contains("react-flow__pane") &&
        connectingNodeId.current
      ) {
        const promptCount = nodes.filter((n) => n.type === "prompt").length;

        if (promptCount >= 3) {
          connectingNodeId.current = null;
          return;
        }

        const position = project({
          x: (event as MouseEvent).clientX - reactFlowBounds.left,
          y: (event as MouseEvent).clientY - reactFlowBounds.top,
        });

        const newNodeId = `${+new Date()}`;

        const newNode: Node = {
          id: newNodeId,
          type: "prompt",
          position,
          data: { label: "Prompt Node" },
          deletable: !isRunning,
        };

        setNodes((nds) => {
          const updated = [...nds, newNode];

          setEdges((eds) =>
            addEdge(
              {
                id: `e${connectingNodeId.current}-${newNodeId}`,
                source: connectingNodeId.current!,
                sourceHandle: "right",
                target: newNodeId,
                targetHandle: "left",
              },
              eds
            )
          );

          return updated;
        });
      }

      connectingNodeId.current = null;
    },
    [project, isRunning, nodes]
  );

  const runFlow = async () => {
    setIsRunning(true);
    const visited = new Set<string>();

    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        deletable: false,
        data: {
          ...n.data,
          isRunning: false,
        },
      }))
    );

    const runNode = async (id: string) => {
      // Mark current node as running
      setNodes((nds) =>
        nds.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  isRunning: true,
                },
              }
            : node
        )
      );

      await new Promise((res) => setTimeout(res, 1000)); // Simulate processing delay

      // Mark current node as done
      setNodes((nds) =>
        nds.map((node) =>
          node.id === id && id !== "start"
            ? {
                ...node,
                data: {
                  ...node.data,
                  isRunning: false,
                },
              }
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

    // 🧠 All nodes done — now set isRunning to false
    setIsRunning(false);

    // Make prompt nodes deletable again
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        deletable: n.id !== "start",
      }))
    );
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
                isRunning, // ✅ inject global running status
              },
            }
          : n
      )
    );
  }, [edges, isRunning]); // ✅ include isRunning as a dependency

  return (
    <ReactFlow
      nodeTypes={nodeTypes}
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onConnectStart={onConnectStart}
      onConnectEnd={onConnectEnd}
      fitView
      className="react-flow w-full h-full"
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <Controls />
    </ReactFlow>
  );
}
