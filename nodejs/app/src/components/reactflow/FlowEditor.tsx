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

const STORAGE_KEY = {
  NODES: "reactflow-nodes",
  EDGES: "reactflow-edges",
};

export default function FlowEditor({
  start,
  pollForRequests,
  pollRecording,
}: {
  start: (prompt: string) => Promise<string>;
  pollForRequests: (sessionId: string) => Promise<boolean | undefined>;
  pollRecording: (sessionId: string) => Promise<string | undefined>;
}) {
  const initialNodes: Node[] = [
    {
      id: "start",
      type: "start",
      position: { x: 100, y: 100 },
      data: { label: "Start Node" },
      deletable: false,
    },
  ];

  const loadNodes = (): Node[] => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY.NODES);
      return saved ? JSON.parse(saved) : initialNodes;
    } catch {
      return initialNodes;
    }
  };

  const loadEdges = (): Edge[] => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY.EDGES);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  };

  const [nodes, setNodes, onNodesChange] = useNodesState(loadNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(loadEdges());
  const { project } = useReactFlow();
  const [isRunning, setIsRunning] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [pendingConnection, setPendingConnection] = useState<string | null>(
    null
  );

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

        // Show selection menu
        setMenuPosition({
          x: (event as MouseEvent).clientX,
          y: (event as MouseEvent).clientY,
        });
        setPendingConnection(connectingNodeId.current);
      }

      connectingNodeId.current = null;
    },
    [project, nodes]
  );

  const createNodeAtPosition = (
    type: string,
    screenPos: { x: number; y: number },
    sourceId: string | null
  ) => {
    const reactFlowBounds = (
      document.querySelector(".react-flow") as HTMLDivElement
    )?.getBoundingClientRect();

    const position = project({
      x: screenPos.x - reactFlowBounds.left,
      y: screenPos.y - reactFlowBounds.top,
    });

    const newNodeId = `${+new Date()}`;
    const newNode: Node = {
      id: newNodeId,
      type,
      position,
      data: { label: `${type} node` },
      deletable: !isRunning,
    };

    setNodes((nds) => {
      const updated = [...nds, newNode];

      if (sourceId) {
        setEdges((eds) =>
          addEdge(
            {
              id: `e${sourceId}-${newNodeId}`,
              source: sourceId,
              sourceHandle: "right",
              target: newNodeId,
              targetHandle: "left",
            },
            eds
          )
        );
      }

      return updated;
    });
  };

  const runFlow = async () => {
    setIsRunning(true);
    const visited = new Set<string>();

    setNodes((nds) =>
      nds.map((n) =>
        n.id === "start"
          ? { ...n, deletable: false }
          : {
              ...n,
              deletable: false,
              data: {
                ...n.data,
                isRunning: false,
                sessionId: "",
                liveViewUrl: "",
                videoUrl: "",
                result: undefined,
              },
            }
      )
    );

    const runNode = async (id: string) => {
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

      const currentNode = nodes.find((n) => n.id === id);
      const prompt = currentNode?.data?.prompt || "";

      if (currentNode?.type === "prompt") {
        const sessionId = await start(prompt);
        const infoRes = await fetch(`/relayer/${sessionId}/info`);
        const { liveViewUrl } = await infoRes.json();

        setNodes((nds) =>
          nds.map((node) =>
            node.id === id
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    sessionId,
                    liveViewUrl,
                  },
                }
              : node
          )
        );

        const maxAttempts = 1000;
        const pollInterval = 1000;
        let attempts = 0;

        const result: boolean | undefined = await new Promise((resolve) => {
          const interval = setInterval(async () => {
            const res = await pollForRequests(sessionId);
            attempts++;
            if (res !== undefined || attempts >= maxAttempts) {
              clearInterval(interval);
              resolve(res);
            }
          }, pollInterval);
        });

        if (result !== undefined) {
          setNodes((nds) =>
            nds.map((node) =>
              node.id === id
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      result,
                    },
                  }
                : node
            )
          );

          pollRecording(sessionId).then((videoUrl) => {
            if (videoUrl) {
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === id
                    ? {
                        ...node,
                        data: {
                          ...node.data,
                          videoUrl,
                        },
                      }
                    : node
                )
              );
            }
          });
        }
      }

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
      await Promise.all(
        nextEdges
          .filter((edge) => !visited.has(edge.target))
          .map((edge) => runNode(edge.target))
      );
    };

    await runNode("start");
    setIsRunning(false);

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
                isRunning,
              },
            }
          : n
      )
    );
  }, [edges, isRunning]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY.NODES, JSON.stringify(nodes));
  }, [nodes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY.EDGES, JSON.stringify(edges));
  }, [edges]);

  return (
    <div className="w-full h-full relative">
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

      {menuPosition && (
        <div
          className="absolute bg-[#1E1E1E] border border-gray-700 rounded-lg shadow-lg z-10 w-72"
          style={{ left: menuPosition.x, top: menuPosition.y }}
        >
          <div className="p-3 font-semibold text-white border-b border-gray-700">
            Add Node
          </div>

          <button
            className="w-full text-left px-4 py-2 text-white hover:bg-[#2A2A2A]"
            onClick={() => {
              createNodeAtPosition("prompt", menuPosition, pendingConnection);
              setMenuPosition(null);
            }}
          >
            Custom Task Node
          </button>

          <button
            className="w-full text-left px-4 py-2 text-white hover:bg-[#2A2A2A]"
            disabled
          >
            Access Recall Network
          </button>

          <button
            className="w-full text-left px-4 py-2 text-gray-500 cursor-not-allowed"
            disabled
          >
            Swap
          </button>

          <button
            className="w-full text-left px-4 py-2 text-gray-500 cursor-not-allowed"
            disabled
          >
            Lending
          </button>

          <button
            className="w-full text-left px-4 py-2 text-gray-500 cursor-not-allowed"
            disabled
          >
            Create NFT
          </button>

          <button
            className="w-full text-left px-4 py-2 text-gray-500 cursor-not-allowed"
            disabled
          >
            Crosschain Bridge
          </button>

          <button
            className="w-full text-left px-4 py-2 text-gray-500 cursor-not-allowed"
            disabled
          >
            Game
          </button>

          <button
            className="w-full text-left px-4 py-2 text-red-500 hover:bg-[#2A2A2A] border-t border-gray-700"
            onClick={() => setMenuPosition(null)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
