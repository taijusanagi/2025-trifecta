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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import { toast } from "react-toastify";

import StartNode from "./StartNode";
import PromptNode from "./PromptNode";
import { RecallClient } from "@recallnet/sdk/client";

import { createPublicClient, http } from "viem";
import { testnet } from "@recallnet/chains";

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
  const isConnecting = useRef(false); // Track connect mode

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  const onConnectStart = useCallback((_: any, params: OnConnectStartParams) => {
    connectingNodeId.current = params.nodeId || null;
    isConnecting.current = true;
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
          toast.warn("You can only create up to 3 nodes for this hackathon.", {
            position: "top-right",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: false,
            pauseOnHover: true,
          });
          connectingNodeId.current = null;
          isConnecting.current = false;
          return;
        }

        const rawX = (event as MouseEvent).clientX;
        const rawY = (event as MouseEvent).clientY;

        const menuWidth = 288; // w-72 = 18rem = 288px
        const menuHeight = 350; // estimate, adjust if needed

        const clampedX = Math.min(
          Math.max(0, rawX),
          window.innerWidth - menuWidth
        );
        const clampedY = Math.min(
          Math.max(0, rawY),
          window.innerHeight - menuHeight
        );

        setMenuPosition({ x: clampedX, y: clampedY });
        setPendingConnection(connectingNodeId.current);
      }

      connectingNodeId.current = null;

      // Delay clearing connect mode so onPaneClick doesn’t close the menu immediately
      setTimeout(() => {
        isConnecting.current = false;
      }, 0);
    },
    [project, nodes]
  );

  const handlePaneClick = () => {
    if (!isConnecting.current) {
      setMenuPosition(null);
    }
  };

  const createNodeAtPosition = (
    type: string,
    screenPos: { x: number; y: number },
    sourceId: string | null,
    task?: string
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
      data: { label: `${type} node`, prompt: task },
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
      try {
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
      } catch (error) {
        console.error(`Error running node ${id}:`, error);
        setNodes((nds) =>
          nds.map((node) =>
            node.id === id
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    isRunning: false,
                    result: false,
                    sessionId: "",
                    liveViewUrl: "",
                    videoUrl: "",
                  },
                }
              : node
          )
        );
      }
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

  const handleClearFlow = () => {
    localStorage.removeItem(STORAGE_KEY.NODES);
    localStorage.removeItem(STORAGE_KEY.EDGES);
    setIsRunning(false);
    const resetStartNode: Node = {
      id: "start",
      type: "start",
      position: { x: 100, y: 100 },
      data: {
        label: "Start Node",
        isRunning: false,
      },
      deletable: false,
    };
    setNodes([resetStartNode]);
    setEdges([]);
    setMenuPosition(null);
  };

  const publicClient = createPublicClient({
    chain: testnet,
    transport: http(), // Uses the default RPC URL from the chain object
  });
  const recall = useMemo(() => {
    const client = new RecallClient({ publicClient });
    const bucketManager = client.bucketManager();
    return { client, bucketManager };
  }, []);

  const [isRecallModalOpen, setIsRecallModalOpen] = useState(false);
  const [bucketId, setBucketId] = useState("");
  const [taskObjects, setTaskObjects] = useState<any[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  useEffect(() => {
    const bucketId = window.localStorage.getItem("bucketId");
    if (bucketId) {
      setBucketId(bucketId);
    }
  }, []);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!recall?.bucketManager || !bucketId) {
        setTaskObjects([]);
        return;
      }

      setIsLoadingTasks(true);

      try {
        const {
          result: { objects },
        } = await recall.bucketManager.query(bucketId as `0x${string}`);

        const decodedTasks = await Promise.all(
          objects.map(async (obj: any) => {
            try {
              const { result: file } = await recall.bucketManager.get(
                bucketId as `0x${string}`,
                obj.key
              );
              const decoded = new TextDecoder().decode(file);
              const json = JSON.parse(decoded);
              return {
                key: obj.key,
                ...json,
              };
            } catch (err) {
              console.error(`Failed to decode or parse ${obj.key}`, err);
              return null;
            }
          })
        );

        setTaskObjects(decodedTasks.filter(Boolean));
      } catch (err) {
        console.error("Failed to fetch tasks from Recall:", err);
      } finally {
        setIsLoadingTasks(false);
      }
    };

    fetchTasks();
  }, [recall?.bucketManager, bucketId]);

  return (
    <div className="w-full h-full relative">
      <button
        onClick={handleClearFlow}
        className="absolute top-18 right-4 z-50 p-2 bg-white/10 hover:bg-white/20 rounded-full"
        title="Clear Flow"
      >
        <Trash2 className="w-5 h-5 text-white" />
      </button>
      <ReactFlow
        nodeTypes={nodeTypes}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onPaneClick={handlePaneClick}
        onNodeDragStart={() => setMenuPosition(null)}
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
            Add Task Node
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

          {/* Other disabled options */}
          <button
            className="w-full text-left px-4 py-2 text-white hover:bg-[#2A2A2A]"
            onClick={() => {
              setIsRecallModalOpen(true);
            }}
          >
            Access Recall Storage Network
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
        </div>
      )}
      {isRecallModalOpen && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50">
          <div className="relative bg-[#1a1a1a] rounded-xl p-6 border border-white/20 w-full max-w-md max-h-[90vh] shadow-lg">
            <button
              onClick={() => setIsRecallModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-white mb-2">
              Select Task from Recall Storage
            </h2>

            {/* Bucket ID input with margin bottom */}
            <div className="space-y-1 mb-4">
              <label className="text-sm text-gray-300">Bucket ID</label>
              <input
                type="text"
                placeholder="Bucket ID"
                value={bucketId}
                onChange={(e) => {
                  window.localStorage.setItem("bucketId", e.target.value);
                  setBucketId(e.target.value);
                }}
                className="w-full px-3 py-2 rounded-md bg-white/10 text-white border border-white/20 text-sm"
              />
            </div>

            {/* Scrollable task list */}
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {isLoadingTasks ? (
                <div className="text-center text-sm text-gray-400">
                  Loading tasks...
                </div>
              ) : taskObjects.length === 0 ? (
                <div className="text-center text-sm text-gray-500">
                  No tasks found in this bucket.
                </div>
              ) : (
                taskObjects.map((item) => (
                  <button
                    key={item.key}
                    className="w-full px-4 py-3 rounded-md bg-white/10 text-white hover:bg-white/20 text-left cursor-pointer"
                    onClick={() => {
                      createNodeAtPosition(
                        "prompt",
                        { x: window.innerWidth / 2, y: window.innerHeight / 2 },
                        pendingConnection,
                        item.task
                      );
                      setIsRecallModalOpen(false);
                    }}
                  >
                    <div className="font-medium mb-1">{item.task}</div>

                    {item.referenceUrl && (
                      <div className="text-xs text-gray-400 break-all">
                        {item.referenceUrl}
                      </div>
                    )}

                    <a
                      href={`https://portal.recall.network/buckets/${bucketId}?path=${encodeURIComponent(
                        item.key
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline text-blue-400 hover:text-blue-300"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View on Recall Portal
                    </a>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
