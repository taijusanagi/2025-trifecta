"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ConnectButton, useConnectModal } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAccount, useWalletClient } from "wagmi";
import { JsonRpcRequest } from "@/types/json-rpc-request";
import { hexToString } from "viem";
import { CircleOff, Loader2, Workflow, X } from "lucide-react";
import clsx from "clsx";
import { ReactFlowProvider } from "reactflow";
import FlowEditor from "@/components/reactflow/FlowEditor";
import { ToastContainer, toast } from "react-toastify";

export default function Home() {
  const BROWSER_USE_API_URL = process.env.NEXT_PUBLIC_BROWSER_USE_API_URL;
  const BROWSER_USE_API_KEY = process.env.NEXT_PUBLIC_BROWSER_USE_API_KEY;

  const POLLING_INTERVAL = 5000;

  const { openConnectModal } = useConnectModal();

  const { address, chain } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [sessionId, setSessionId] = useState("");

  const taskExamples = [
    {
      title: "Launch Your NFT",
      description:
        "Create and launch your own NFT collection on Magic Eden effortlessly.",
      task: "Go to https://magiceden.io. Add Magic Eden extra https header origin. Click login. Click View all wallets. Click Headless Web3 Provider. Click Create. Click Create New NFT Collection. Only input Name as 'My Special NFT 1' and Symbol as 'MSNFT1'. Do not input or change other information and file. Scroll down and click Publish on Base. Then wait until transaction confirmation. Click view collection. Get collection detail.",
    },
    {
      title: "Discover Vitalik's Ethereum Address",
      description:
        "Instantly fetch Ethereum founder Vitalik Buterin's official wallet address.",
      task: "Get Vitalik Buterin's Ethereum address",
    },
    {
      title: "Interactive Course on Momentum",
      description: "Manus develops engaging video presentations...",
      task: "Create an interactive course on momentum for middle school students...",
    },
  ];

  const [task, setTask] = useState(taskExamples[0].task);

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

  const [showReactFlow, setShowReactFlow] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState("");

  const handleWalletRequest = useCallback(
    async (request: JsonRpcRequest) => {
      if (!walletClient) {
        throw new Error("Wallet client not available");
      }
      console.log("Handling wallet request:", request);

      try {
        const response = await toast.promise(
          (async () => {
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
          })(),
          {
            pending: `${request.method} is pending...`,
            success: `${request.method} succeeded 👌`,
            error: {
              render({ data }: any) {
                return `${request.method} failed: ${
                  data.message || "Unknown error"
                } 🤯`;
              },
            },
          }
        );

        return response;
      } catch (error: any) {
        console.error("Error handling wallet request:", error);
        return { result: error.message || "Unknown error" };
      }
    },
    [walletClient]
  );

  const pollForRequests = useCallback(
    async (sessionId: string): Promise<boolean | undefined> => {
      // Return early if conditions aren't met
      if (isPollingRef.current) return;
      isPollingRef.current = true;
      let isSuccessed = undefined;
      let updatedSessionStatus = "";
      try {
        const logRes = await fetch(`/relayer/${sessionId}/log`);
        if (logRes.ok) {
          const { logs } = await logRes.json();
          setThinking(logs);
          if (logs.length > 0) {
            const latestLog = logs[logs.length - 1];
            const done = latestLog.action.find((obj: any) => obj.done);
            if (done) {
              const {
                done: { success },
              } = done;
              isSuccessed = success;
              updatedSessionStatus = "idle";
              setSessionStatus("idle");
            }
          }
        }

        if (updatedSessionStatus !== "idle") {
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
        }
      } catch (error) {
        console.error("Error in polling:", error);
      } finally {
        isPollingRef.current = false;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (updatedSessionStatus !== "idle") {
          timeoutRef.current = setTimeout(
            () => pollForRequests(sessionId),
            POLLING_INTERVAL
          );
        }
      }
      return isSuccessed;
    },
    [handleWalletRequest]
  );

  const pollRecording = async (
    sessionId: string
  ): Promise<string | undefined> => {
    return new Promise((resolve) => {
      const maxAttempts = 1000; // max retries (30 seconds)
      let attempts = 0;
      const interval = setInterval(async () => {
        try {
          const response = await fetch(
            `/anchorbrowser/recording/${sessionId}`,
            {
              method: "GET",
              headers: { "Content-Type": "application/json" },
            }
          );
          if (!response.ok) {
            console.warn("Polling failed:", response.statusText);
            attempts++;
            if (attempts >= maxAttempts) {
              clearInterval(interval);
              resolve(undefined);
            }
            return;
          }

          const data = await response.json();
          const recordingUrl = data?.recordingUrl;

          if (recordingUrl) {
            clearInterval(interval);
            resolve(recordingUrl);
          } else {
            attempts++;
            if (attempts >= maxAttempts) {
              clearInterval(interval);
              resolve(undefined);
            }
          }
        } catch (err) {
          console.error("Polling error:", err);
          attempts++;
          if (attempts >= maxAttempts) {
            clearInterval(interval);
            resolve(undefined);
          }
        }
      }, POLLING_INTERVAL);
    });
  };

  const handleStart = async () => {
    if (!address || !chain?.id) {
      throw new Error("Please connect your wallet first.");
    }

    setSessionStatus("creating");

    try {
      const sessionId = await start(address, chain.id, task);
      setSessionId(sessionId);
    } catch (error) {
      console.error(error);
      setSessionStatus("idle");
    }
  };

  const start = async (address: string, chainId: number, task: string) => {
    let anchorSessionId = "";
    let liveViewUrl = "";
    if (process.env.NEXT_PUBLIC_IS_LOCAL_BROWSER !== "true") {
      console.log("Starting anchorbrowser...");
      const anchorbrowserCreateResponse = await fetch("/anchorbrowser/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!anchorbrowserCreateResponse.ok) {
        throw new Error("Failed to start anchorbrowser.");
      }

      const { id, live_view_url } = await anchorbrowserCreateResponse.json();
      liveViewUrl = live_view_url;
      console.log("Starting anchorbrowser done!");
      console.log("anchorSessionId", id);
      console.log("liveViewUrl", liveViewUrl);
      setLiveViewUrl(liveViewUrl);
      anchorSessionId = id;
    }

    console.log("Starting session...");
    const createSessionResponse = await fetch("/relayer/create-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address,
        chainId,
        task,
        anchorSessionId,
        liveViewUrl,
      }),
    });

    if (!createSessionResponse.ok) {
      throw new Error("Failed to create relayer session.");
    }

    const { sessionId } = await createSessionResponse.json();
    console.log("Starting session done!");
    console.log("sessionId", sessionId);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (BROWSER_USE_API_KEY) {
      headers["Authorization"] = `Bearer ${BROWSER_USE_API_KEY}`;
    }

    fetch(`${BROWSER_USE_API_URL}/chat`, {
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

    console.log("Done!!");
    return sessionId;
  };

  useEffect(() => {
    if (!sessionId) return;

    const fetchInfo = async () => {
      try {
        let currentSessionStatus = "";
        const res = await fetch(`/relayer/${sessionId}/info`);
        const data = await res.json();
        if (data.task) setTask(data.task);
        if (data.liveViewUrl) setLiveViewUrl(data.liveViewUrl);
        setIsRunning(true);
        if (data.success !== undefined) {
          currentSessionStatus = "idle";
        } else {
          currentSessionStatus = "active";
        }
        setSessionStatus(currentSessionStatus as any);
        pollForRequests(sessionId);
      } catch (err) {
        console.error("Failed to fetch session info:", err);
      }
    };

    fetchInfo();
  }, [sessionId, pollForRequests]);

  const handleStop = () => {
    setSessionId("");
    setLiveViewUrl("");
    setIsRunning(false);
    setThinking([]);
    setSessionStatus("idle");
  };

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.innerWidth >= 768 && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [thinking]);

  useEffect(() => {
    if (sessionId && sessionStatus == "idle") {
      pollRecording(sessionId).then((result) => {
        if (result) {
          setRecordingUrl(result);
        }
      });
    }
  }, [sessionId, sessionStatus]);

  const renderIndented = (value: any): React.ReactNode => {
    if (typeof value === "object" && value !== null) {
      return (
        <ul className={`ml-1 mt-1 space-y-1`}>
          {Object.entries(value).map(([k, v], i) => (
            <li key={i}>
              <span className="font-medium text-gray-300">{k}:</span>
              <div className="ml-4">
                {typeof v === "object" && v !== null ? (
                  renderIndented(v)
                ) : (
                  <span className="text-gray-200 text-sm block mt-0.5">
                    {String(v)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      );
    }
    return <span className="text-sm text-gray-200">{String(value)}</span>;
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
              onClick={!address || !chain?.id ? openConnectModal : handleStart}
              disabled={sessionStatus === "creating"}
              className="mt-4 w-full bg-white/80 text-black hover:bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {!address || !chain?.id ? (
                "Connect Wallet"
              ) : sessionStatus === "creating" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting...
                </>
              ) : (
                "Start"
              )}
            </Button>
          </div>

          {/* Featured examples section remains unchanged */}
          <div className="mt-8 w-full text-left">
            <div className="flex gap-3 mb-6">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    if (cat !== "Community") setCategory(cat);
                  }}
                  disabled={cat === "Community"}
                  className={clsx(
                    "px-5 py-2 rounded-full border transition font-semibold",
                    cat === "Community"
                      ? "text-gray-600 border-gray-700 cursor-not-allowed"
                      : category === cat
                      ? "bg-white text-black border-white"
                      : "text-gray-400 border-gray-600 hover:border-white hover:text-white"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {category === "Featured" &&
                taskExamples.map((t, i) => (
                  <div
                    key={i}
                    onClick={() => setTask(t.task)}
                    className="cursor-pointer bg-white/10 hover:bg-white/20 p-4 rounded-xl border border-white/20 transition shadow"
                  >
                    <h3 className="text-white font-semibold text-lg mb-2">
                      {t.title}
                    </h3>
                    <p className="text-gray-300 text-sm">{t.description}</p>
                  </div>
                ))}
            </div>
          </div>
        </main>
      ) : (
        // === ACTIVE SESSION 3:7 SPLIT VIEW ===
        <main className="flex flex-col-reverse lg:flex-row gap-x-6 gap-y-4 w-full max-w-7xl mx-auto transition-all duration-700 ease-in-out lg:h-[calc(100vh-120px)]">
          {/* === LEFT PANEL === */}
          <div className="w-full lg:w-3/10 flex flex-col gap-6 h-full overflow-y-auto">
            <div className="flex flex-col gap-4 backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-4 shadow-lg h-full">
              {/* === Header === */}
              <h2 className="text-xl font-semibold text-white">
                Glider Computer
              </h2>

              {/* === Session Status Box === */}
              <div
                className={clsx(
                  "flex items-center justify-between text-sm px-3 py-2 rounded-md shadow border",
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
                      <div className="mt-1 font-mono text-xs">{sessionId}</div>
                    </>
                  )}
                </div>
              </div>

              {/* === Scrollable thinking section === */}
              <ul className="space-y-4 overflow-y-auto pr-2 flex-1">
                {thinking.map((step, index) => {
                  const nonNullActions = Object.entries(
                    step.action?.[0] || {}
                  ).filter(([, value]) => value !== null);

                  return (
                    <li
                      key={index}
                      className="p-4 bg-white/10 rounded-md border border-white/20 text-sm break-words"
                    >
                      <p className="font-medium text-white">Step {index + 1}</p>
                      <p className="text-gray-300 mt-2">
                        <p className="font-semibold">Previous Goal:</p>
                        <p>{step.current_state.evaluation_previous_goal}</p>
                      </p>
                      <p className="text-gray-300 mt-2">
                        <p className="font-semibold">Next Goal:</p>
                        <p>{step.current_state.next_goal}</p>
                      </p>

                      {nonNullActions.length > 0 && (
                        <div className="mt-2">
                          <p className="font-semibold text-gray-300">
                            Actions:
                          </p>
                          <ul className="mt-1 text-gray-200">
                            {nonNullActions.map(([key, value], i) => (
                              <li key={i} className="mt-1">
                                <span className="font-medium text-gray-300">
                                  {key}:
                                </span>
                                <div className="ml-4">
                                  {renderIndented(value)}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  );
                })}
                {(sessionStatus === "creating" ||
                  sessionStatus === "active") && (
                  <li className="flex items-center gap-3 text-gray-300 text-sm italic animate-pulse pl-2">
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>
                      <span className="font-semibold text-white">
                        Glider Computer
                      </span>{" "}
                      is now processing...
                    </span>
                  </li>
                )}
                <span ref={logsEndRef} />
              </ul>
            </div>
          </div>

          {/* === RIGHT PANEL === */}
          <div className="w-full lg:w-7/10 flex flex-col gap-4">
            <div className="w-full aspect-video rounded-xl overflow-hidden shadow-2xl relative border border-white/10 backdrop-blur-md bg-white/5 hover:border-white/20 transition">
              <div className="absolute top-3 left-4 z-10 bg-black/40 px-3 py-1 text-sm rounded-md font-semibold">
                {sessionStatus == "idle" ? "Recorded Video" : "Live View"}
              </div>
              {sessionStatus === "idle" && !recordingUrl ? (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="ml-2">Loading recorded video...</span>
                </div>
              ) : recordingUrl ? (
                <video
                  src={recordingUrl}
                  controls
                  autoPlay
                  muted
                  className="w-full h-full rounded-md"
                />
              ) : (
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
      {showReactFlow && (
        <div
          className={clsx(
            "fixed inset-0 z-20 flex items-center justify-center backdrop-blur-sm"
          )}
        >
          <div className="relative w-full h-full">
            <ReactFlowProvider>
              <div className="w-full h-full rounded-lg border border-white/10 bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2c2c2c] shadow-2xl overflow-hidden">
                <FlowEditor
                  start={(prompt) => start(address!, chain!.id, prompt)}
                  pollForRequests={(sessionId) => pollForRequests(sessionId)}
                  pollRecording={(sessionId) => pollRecording(sessionId)}
                />
              </div>
            </ReactFlowProvider>
          </div>
        </div>
      )}
      <ToastContainer />
    </div>
  );
}
