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
  const POLLING_INTERVAL = 1000;

  const { address, chain } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [task, setTask] = useState(
    "Go to https://magiceden.io. Add Magic Eden extra https header origin. Then login or connect. If you need to choose wallet, choose Headless Web3 Provider or Injected Wallet or Metamask. If you need to choose chain, choose Base Network."
  );
  const [history, setHistory] = useState<any[]>([]);
  const [isPolling, setIsPolling] = useState(false);

  // Use a ref to track the timeout ID for proper cleanup
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Use a ref to prevent concurrent polling
  const isPollingRef = useRef(false);

  const handleWalletRequest = useCallback(
    async (request: JsonRpcRequest) => {
      if (!walletClient) {
        throw new Error("Wallet client not available");
      }

      console.log("handleWalletRequest", request);

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
    console.log("pollForRequests 1...");
    // Return early if no session or already polling
    if (!sessionId || !isPolling || isPollingRef.current) {
      return;
    }
    console.log("pollForRequests 2...");

    // Set polling flag to prevent concurrent polling
    isPollingRef.current = true;

    try {
      const response = await fetch(`/relayer/${sessionId}/request`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        console.log("Failed to fetch request");
        // Don't throw, just log and continue
      } else {
        const data = await response.json();
        console.log("data", data);
        // If we have a request to process
        if (data && data.id) {
          setIsPolling(false);
          const request: JsonRpcRequest = data;
          console.log("Received request:", request);

          try {
            // Process the request with the wallet
            const { result } = await handleWalletRequest(request);
            console.log("result", result);

            // Send the result back to the relayer
            await fetch(`/relayer/${sessionId}/response`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                result,
              }),
            });

            setHistory((prev) => [
              ...prev,
              {
                type: "wallet_request",
                request,
                response: result,
              },
            ]);
          } catch (reqError) {
            console.error("Error processing request:", reqError);
          }
        }
      }
    } catch (error) {
      console.error("Error in polling:", error);
    } finally {
      // Reset polling flag
      isPollingRef.current = false;

      // Only continue polling if still active
      if (isPolling) {
        // Clear any existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Schedule next poll
        timeoutRef.current = setTimeout(pollForRequests, POLLING_INTERVAL);
      }
    }
  }, [sessionId, isPolling, handleWalletRequest]);

  // Handle polling initialization and cleanup
  useEffect(() => {
    if (sessionId && isPolling) {
      // Start polling immediately
      pollForRequests();
    }

    // Cleanup function to stop polling when component unmounts or dependencies change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [sessionId, isPolling, pollForRequests]);

  // Toggle polling state when sessionId changes
  useEffect(() => {
    if (sessionId && !isPolling) {
      setIsPolling(true);
    } else if (!sessionId && isPolling) {
      setIsPolling(false);
    }
  }, [sessionId, isPolling]);

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

      const { sessionId: newSessionId } = await createSessionResponse.json();
      setSessionId(newSessionId);

      const startResponse = await fetch(`${BROWSER_USE_API_URL}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: newSessionId, task }),
      });

      if (!startResponse.ok) {
        throw new Error("Failed to start browser use session.");
      }

      const {
        result: { history: sessionHistory },
      } = await startResponse.json();
      console.log("history", sessionHistory);
      setHistory(sessionHistory); // Update state to display history
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Add a function to stop polling manually if needed
  const stopPolling = useCallback(() => {
    setIsPolling(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

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
        <Button onClick={handleStart} disabled={loading}>
          {loading ? "Starting..." : "Start"}
        </Button>

        {/* Session Status */}
        {sessionId && (
          <div className="w-full p-3 bg-green-100 border border-green-300 rounded-md">
            <p className="text-sm">
              Session active: <span className="font-mono">{sessionId}</span>
            </p>
            <p className="text-xs text-green-700">
              {isPolling ? "Listening for wallet requests..." : "Idle"}
            </p>
            {isPolling && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 text-xs"
                onClick={stopPolling}
              >
                Stop Polling
              </Button>
            )}
          </div>
        )}

        {/* History Display */}
        {history.length > 0 && (
          <div className="mt-6 w-full">
            <h2 className="text-lg font-semibold mb-2">Execution History</h2>
            <ul className="space-y-2">
              {history.map((step, index) => (
                <li
                  key={index}
                  className="p-3 border rounded-md bg-gray-100 text-sm"
                >
                  {step.type === "wallet_request" ? (
                    // Wallet request display
                    <>
                      <p className="font-medium text-blue-700">
                        Wallet Request:
                      </p>
                      <pre className="text-xs bg-gray-200 p-2 rounded my-1 overflow-x-auto">
                        {JSON.stringify(step.request, null, 2)}
                      </pre>
                      <p className="font-medium text-green-700">Response:</p>
                      <pre className="text-xs bg-gray-200 p-2 rounded my-1 overflow-x-auto">
                        {JSON.stringify(step.response, null, 2)}
                      </pre>
                    </>
                  ) : (
                    // Browser automation history display
                    <>
                      <p className="font-medium">Step {index}:</p>
                      <p>{step.result?.[0]?.extracted_content}</p>
                      <p className="text-xs text-gray-600">
                        Success: {step.result?.[0]?.success ? "✅" : "❌"} |
                        Done: {step.result?.[0]?.is_done ? "✅" : "❌"}
                      </p>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
