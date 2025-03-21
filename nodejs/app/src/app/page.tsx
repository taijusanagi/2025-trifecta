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
    "Go to https://magiceden.io. Add Magic Eden extra https header origin. Open developer tool to show the console. Cick login or connect. If you need to choose wallet, choose Headless Web3 Provider or Injected Wallet or Metamask. If you need to choose chain, choose EVM Base Network. Then get one collection name."
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

      const anchorbrowserResponse = await fetch("/anchorbrowser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!anchorbrowserResponse.ok) {
        throw new Error("Failed to start anchorbrowser.");
      }

      const { id: anchorSessionId, live_view_url: liveViewUrl } =
        await anchorbrowserResponse.json();
      setLiveViewUrl(liveViewUrl);

      const startResponse = await fetch(`${BROWSER_USE_API_URL}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          task,
          anchor_session_id: anchorSessionId,
        }),
      });

      if (!startResponse.ok) {
        throw new Error("Failed to start browser-use.");
      }

      const {
        result: { history },
      } = await startResponse.json();
      setHistory(history); // Update state to display history
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
