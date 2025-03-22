"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAccount, useWalletClient } from "wagmi";
import { JsonRpcRequest } from "@/types/json-rpc-request";
import { hexToString } from "viem";
import { CircleOff, Loader2, Workflow, X } from "lucide-react";
import clsx from "clsx";
import { ReactFlowProvider } from "reactflow";
import FlowEditor from "@/components/reactflow/FlowEditor";

export default function Home() {
  const BROWSER_USE_API_URL = process.env.NEXT_PUBLIC_BROWSER_USE_API_URL;
  const BROWSER_USE_API_KEY = process.env.NEXT_PUBLIC_BROWSER_USE_API_KEY;

  const POLLING_INTERVAL = 5000;

  const { address, chain } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [sessionId, setSessionId] = useState("");
  const [task, setTask] = useState(
    "Go to https://magiceden.io. Add Magic Eden extra https header origin. Click login. Click View all wallets. Click Headless Web3 Provider. Click Create. Click Create New NFT Collection. Only input Name as 'My Special NFT 1' and Symbol as 'MSNFT1'. Do not input or change other information and file. Scroll down and click Publish on Base. Then wait until transaction confirmation. Click view collection. Get collection detail."
  );
  const [history, setHistory] = useState<any[]>([]);

  const [isPolling, setIsPolling] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  const [liveViewUrl, setLiveViewUrl] = useState("");
  const [thinking, setThinking] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<
    "idle" | "creating" | "active"
  >("idle");
  const [category, setCategory] = useState("Featured");
  const categories = ["Featured", "Community"];

  const taskExamples = [
    {
      title: "Discover Vitalik's Ethereum Address 🚀",
      description:
        "Instantly fetch Ethereum founder Vitalik Buterin's official wallet address.",
      task: "Get Vitalik Buterin's Ethereum address",
    },
    {
      title: "Deeply Analyze Tesla Stocks",
      description: "Manus delivers in-depth stock analysis...",
      task: "Analyze Tesla stock performance over the last year...",
    },
    {
      title: "Interactive Course on Momentum",
      description: "Manus develops engaging video presentations...",
      task: "Create an interactive course on momentum for middle school students...",
    },
  ];

  const [showReactFlow, setShowReactFlow] = useState(false);

  const handleWalletRequest = useCallback(
    async (request: JsonRpcRequest) => {
      if (!walletClient) {
        throw new Error("Wallet client not available");
      }
      console.log("Handling wallet request:", request);
      try {
        let result;
        if (request.method === "eth_sendTransaction" && request.params) {
          result = await walletClient.sendTransaction({
            to: request.params[0].to,
            value: request.params[0].value,
            data: request.params[0].data,
          });
        } else if (request.method === "personal_sign" && request.params) {
          result = await walletClient.signMessage({
            message: hexToString(request.params[0]),
          });
        } else {
          throw new Error(`Not Implemented Method: ${request.method}`);
        }
        return { result };
      } catch (error: any) {
        console.error("Error handling wallet request:", error);
        return { error: error.message || "Unknown error" };
      }
    },
    [walletClient]
  );

  const pollForRequests = useCallback(async () => {
    // Return early if conditions aren't met
    if (!sessionId || isPollingRef.current) return;

    isPollingRef.current = true;

    try {
      const logRes = await fetch(`/relayer/${sessionId}/log`);
      if (logRes.ok) {
        const { logs } = await logRes.json();
        console.log("logs", logs);
        setThinking(logs);
      }

      const response = await fetch(`/relayer/${sessionId}/request`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const data = await response.json();

        if (data && data.id) {
          const request: JsonRpcRequest = data;

          try {
            const { result } = await handleWalletRequest(request);

            console.log("handleWalletRequest result", result);
            await fetch(`/relayer/${sessionId}/response`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ result }),
            });
          } catch (reqError) {
            console.error("Error processing request:", reqError);
          }
        }
      }
    } catch (error) {
      console.error("Error in polling:", error);
    } finally {
      isPollingRef.current = false;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(pollForRequests, POLLING_INTERVAL);
    }
  }, [sessionId, handleWalletRequest]);

  const handleStart = async () => {
    if (!address || !chain?.id) {
      throw new Error("Please connect your wallet first.");
    }

    setIsRunning(true);
    setSessionStatus("creating");

    try {
      console.log("Starting session...", { address, chainId: chain.id });
      const createSessionResponse = await fetch("/relayer/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, chainId: chain.id }),
      });

      if (!createSessionResponse.ok) {
        throw new Error("Failed to create relayer session.");
      }

      const { sessionId } = await createSessionResponse.json();
      console.log("Starting session done!");
      console.log("sessionId", sessionId);
      setSessionId(sessionId);
      setSessionStatus("active");
      setIsPolling(true);

      let anchorSessionId = "";
      if (process.env.NEXT_PUBLIC_IS_LOCAL_BROWSER !== "true") {
        console.log("Starting anchorbrowser...");
        const anchorbrowserResponse = await fetch("/anchorbrowser", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!anchorbrowserResponse.ok) {
          throw new Error("Failed to start anchorbrowser.");
        }

        const { id, live_view_url: liveViewUrl } =
          await anchorbrowserResponse.json();
        console.log("Starting anchorbrowser done!");
        console.log("anchorSessionId", id);
        console.log("liveViewUrl", liveViewUrl);
        setLiveViewUrl(liveViewUrl);
        anchorSessionId = id;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (BROWSER_USE_API_KEY) {
        headers["Authorization"] = `Bearer ${BROWSER_USE_API_KEY}`;
      }

      const startResponse = await fetch(`${BROWSER_USE_API_URL}/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          text: JSON.stringify({
            session_id: sessionId,
            task: task,
            anchor_session_id: anchorSessionId,
          }),
        }),
      });

      if (!startResponse.ok) {
        throw new Error("Failed to start browser-use.");
      }

      const { text } = await startResponse.json();
      const parsed = JSON.parse(text);
      setHistory(parsed);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (sessionId && isPolling) {
      pollForRequests();
    }
  }, [sessionId, isPolling, pollForRequests]);

  const handleStop = () => {
    setSessionId("");
    setLiveViewUrl("");
    setIsRunning(false);
    setThinking("");
    setHistory([]);
    setSessionStatus("idle");
  };

  return (
    <div className="min-h-screen px-4 py-4 bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2c2c2c] text-white">
      <header className="mb-6 flex justify-between items-center">
        <div className="flex items-center space-x-1 z-60">
          <img
            src="/logo_transparent.png"
            alt="Glider Logo"
            className="w-12 h-12"
          />
          <span className="text-3xl font-bold text-white tracking-wide">
            Glider
          </span>
        </div>
        <ConnectButton
          chainStatus="none"
          showBalance={false}
          accountStatus="address"
        />
      </header>

      {!isRunning ? (
        // === INITIAL CENTER VIEW ===
        <main className="flex flex-col items-center gap-6 w-full max-w-4xl mx-auto mt-20 text-center transition-all duration-700">
          <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-4 shadow-lg w-full">
            <h1 className="text-3xl font-bold mb-2">Hello!!</h1>
            <p className="text-xl text-gray-400 mb-6">What can I do for you?</p>

            <Textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Enter a goal for the session"
              className="w-full bg-white/10 backdrop-blur-sm border border-white/20 text-white min-h-[120px] rounded-md"
            />

            <Button
              onClick={handleStart}
              className="mt-4 w-full bg-white/80 text-black hover:bg-white cursor-pointer"
            >
              Start
            </Button>
          </div>

          {/* Featured examples section remains unchanged */}
        </main>
      ) : (
        // === ACTIVE SESSION 3:7 SPLIT VIEW ===
        <main className="flex flex-col-reverse lg:flex-row gap-x-6 gap-y-4 w-full max-w-7xl mx-auto transition-all duration-700 ease-in-out">
          {/* === LEFT PANEL === */}
          <div className="w-full lg:w-3/10 flex flex-col gap-6">
            <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-4 shadow-lg">
              {/* === Session Status Box === */}
              <div
                className={clsx(
                  "mb-4 flex items-center justify-between text-sm px-3 py-2 rounded-md shadow border",
                  {
                    "bg-gray-700 text-gray-300 border-gray-600":
                      sessionStatus !== "active",
                    "bg-green-500/20 text-green-300 border-green-600":
                      sessionStatus === "active",
                  }
                )}
              >
                <div>
                  {sessionStatus === "creating" && (
                    <span className="inline-flex items-center gap-2 font-semibold">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating Session
                    </span>
                  )}
                  {sessionStatus === "active" && (
                    <>
                      ● <span className="font-semibold">Session Active</span>
                      <div className="mt-1 font-mono text-xs">{sessionId}</div>
                    </>
                  )}
                  {sessionStatus === "idle" && (
                    <>
                      ●{" "}
                      <span className="font-semibold text-gray-300">
                        Session Inactive
                      </span>
                    </>
                  )}
                </div>
                {sessionStatus === "active" && (
                  <button
                    onClick={handleStop}
                    className="text-red-400 hover:text-red-500 transition cursor-pointer"
                    title="Stop Session"
                  >
                    <CircleOff className="w-5 h-5" />
                  </button>
                )}
              </div>
              {thinking.length > 0 && (
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {thinking.map((log, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-white">
                        AI
                      </div>
                      <div className="flex-1 p-3 rounded-xl bg-white/10 border border-white/20 shadow text-sm text-gray-100">
                        <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                          {typeof log === "string"
                            ? log
                            : JSON.stringify(log, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* === HISTORY === */}
            {history.length > 0 && (
              <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-4 shadow-lg max-h-[360px] overflow-y-auto">
                <h2 className="text-lg font-semibold mb-2">
                  Execution History
                </h2>
                <ul className="space-y-3 pr-1">
                  {history.map((step, index) => {
                    const nonNullActions = Object.entries(
                      step.action?.[0] || {}
                    ).filter(([, value]) => value !== null);
                    return (
                      <li
                        key={index}
                        className="p-3 bg-white/10 rounded-md border border-white/20 text-sm"
                      >
                        <p className="font-medium">Step {index + 1}</p>
                        <p className="text-gray-300">
                          <span className="font-semibold">Previous Goal:</span>{" "}
                          {step.current_state.evaluation_previous_goal}
                        </p>
                        <p className="text-gray-300">
                          <span className="font-semibold">Next Goal:</span>{" "}
                          {step.current_state.next_goal}
                        </p>
                        {nonNullActions.length > 0 && (
                          <div className="mt-1">
                            <p className="font-semibold">Action(s):</p>
                            <ul className="list-disc list-inside text-gray-200">
                              {nonNullActions.map(([key, value], i) => (
                                <li key={i}>
                                  <span className="font-medium">{key}</span>:{" "}
                                  <span className="text-sm">
                                    {typeof value === "object"
                                      ? JSON.stringify(value, null, 2)
                                      : String(value)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* === RIGHT PANEL === */}
          <div className="w-full lg:w-7/10 flex flex-col gap-4">
            <div className="w-full aspect-video rounded-xl overflow-hidden shadow-2xl relative border border-white/10 backdrop-blur-md bg-white/5 hover:border-white/20 transition">
              <div className="absolute top-3 left-4 z-10 bg-black/40 px-3 py-1 text-sm rounded-md font-semibold">
                Live View
              </div>
              {liveViewUrl && (
                <iframe
                  src={liveViewUrl ?? "about:blank"}
                  title="Live View"
                  className="w-full h-full rounded-md"
                  allow="clipboard-read; clipboard-write"
                  sandbox="allow-scripts allow-same-origin"
                />
              )}
            </div>

            <Textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              disabled={true}
              placeholder="Enter a goal for the session"
              className="w-full bg-white/10 backdrop-blur-sm border border-white/20 text-white min-h-[120px] rounded-md"
            />
          </div>
        </main>
      )}

      {/* React Flow Panel Toggle */}
      <div
        className="fixed bottom-6 right-6 z-20 w-16 h-16 bg-white text-black rounded-full shadow-lg hover:bg-gray-200 flex items-center justify-center cursor-pointer z-40"
        onClick={() => setShowReactFlow(!showReactFlow)}
      >
        {!showReactFlow ? (
          <Workflow className="w-8 h-8 cursor-pointer" />
        ) : (
          <X className="w-8 h-8 cursor-pointer" />
        )}
      </div>

      {/* React Flow Fullscreen Overlay */}
      <div
        className={clsx(
          "fixed inset-0 z-20 flex items-center justify-center backdrop-blur-sm transition-opacity duration-700",
          showReactFlow
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none z-[-1]"
        )}
      >
        <div className="relative w-full h-full">
          <ReactFlowProvider>
            <div className="w-full h-full rounded-lg border border-white/10 bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2c2c2c] shadow-2xl overflow-hidden">
              <FlowEditor />
            </div>
          </ReactFlowProvider>
        </div>
      </div>
    </div>
  );
}
