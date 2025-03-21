"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAccount, useWalletClient } from "wagmi";
import { JsonRpcRequest } from "@/types/json-rpc-request";
import { hexToString } from "viem";

export default function Home() {
  const BROWSER_USE_API_URL = process.env.NEXT_PUBLIC_BROWSER_USE_API_URL;
  const POLLING_INTERVAL = 5000;

  const { address, chain } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [task, setTask] = useState(
    "Go to https://magiceden.io. Add Magic Eden extra https header origin. Click login. Click View all wallets. Click Headless Web3 Provider. Click Create. Click Create New NFT Collection. Only input Name as 'My Special NFT 1' and Symbol as 'MSNFT1'. Do not input or change other information and file. Scroll down and click Publish on Base. Then wait until transaction confirmation. Click view collection. Get collection detail."
  );
  const [history, setHistory] = useState<any[]>([]);

  const [isPolling, setIsPolling] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  const [liveViewUrl, setLiveViewUrl] = useState("");

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

    setLoading(true);

    try {
      const createSessionResponse = await fetch("/relayer/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, chainId: chain.id }),
      });

      if (!createSessionResponse.ok) {
        throw new Error("Failed to create relayer session.");
      }

      const { sessionId } = await createSessionResponse.json();
      setSessionId(sessionId);
      setIsPolling(true);

      let anchorSessionId = "";
      if (process.env.NEXT_PUBLIC_IS_LOCAL_BROWSER !== "true") {
        const anchorbrowserResponse = await fetch("/anchorbrowser", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!anchorbrowserResponse.ok) {
          throw new Error("Failed to start anchorbrowser.");
        }

        const { id, live_view_url: liveViewUrl } =
          await anchorbrowserResponse.json();
        setLiveViewUrl(liveViewUrl);
        anchorSessionId = id;
      }

      const startResponse = await fetch(`${BROWSER_USE_API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId && isPolling) {
      pollForRequests();
    }
  }, [sessionId, isPolling, pollForRequests]);

  function parse(input: string) {
    const match = input.match(/^AgentHistoryList\((.*)\)$/);

    if (!match) {
      throw new Error("Input string does not match expected format.");
    }

    const inner = match[1];

    // Step 2: Replace Python/Custom syntax with JSON-compatible syntax
    let jsonCompatible = inner
      .replace(/ActionResult\(/g, "{") // Replace ActionResult( with {
      .replace(/\)/g, "}") // Replace all ) with }
      .replace(/True/g, "true") // Python True -> JS true
      .replace(/False/g, "false") // Python False -> JS false
      .replace(/None/g, "null") // Python None -> JS null
      .replace(/'/g, '"') // single quotes -> double quotes
      .replace(/(\w+)=/g, '"$1":'); // key= -> "key":

    // Step 3: Wrap with braces and parse as a JS object
    const wrapped = `{${jsonCompatible}}`;

    return JSON.parse(wrapped);
  }

  return (
    <div className="p-6">
      <header className="mb-4">
        <ConnectButton />
      </header>
      <main className="flex flex-col items-center gap-4 w-full max-w-xl mx-auto">
        <Textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Enter a task for the session"
          className="w-full min-h-[100px]"
        />

        {!sessionId && (
          <Button onClick={handleStart} disabled={loading}>
            {loading ? "Starting..." : "Start"}
          </Button>
        )}

        {liveViewUrl && (
          <div className="mt-6 w-full">
            <h2 className="text-lg font-semibold mb-2">Live View</h2>
            <div className="aspect-video w-full border rounded-md overflow-hidden">
              <iframe
                src={liveViewUrl}
                title="Live View"
                className="w-full h-full"
                allow="clipboard-read; clipboard-write"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </div>
        )}

        {/* Session Status */}
        {sessionId && (
          <div className="w-full p-3 bg-green-100 border border-green-300 rounded-md">
            <p className="text-sm">
              Session active: <span className="font-mono">{sessionId}</span>
            </p>
          </div>
        )}

        {/* History Display */}
        {history.length > 0 && (
          <div className="mt-6 w-full">
            <h2 className="text-lg font-semibold mb-2">Execution History</h2>
            <ul className="space-y-2">
              {history.map((step, index) => {
                const nonNullActions = Object.entries(
                  step.action?.[0] || {}
                ).filter(([, value]) => value !== null);

                return (
                  <li
                    key={index}
                    className="p-3 border rounded-md bg-gray-100 text-sm"
                  >
                    <p className="font-medium">Step {index + 1}</p>

                    <p className="text-gray-700">
                      <span className="font-semibold">Previous Goal:</span>{" "}
                      {step.current_state.evaluation_previous_goal}
                    </p>

                    <p className="text-gray-700">
                      <span className="font-semibold">Next Goal:</span>{" "}
                      {step.current_state.next_goal}
                    </p>

                    {nonNullActions.length > 0 && (
                      <div className="mt-2">
                        <p className="font-semibold">Action(s):</p>
                        <ul className="list-disc list-inside text-gray-800">
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
      </main>
    </div>
  );
}
