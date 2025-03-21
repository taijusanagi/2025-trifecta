"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea"; // <-- import ShadCN textarea
import { useAccount } from "wagmi";

export default function Home() {
  const BROWSER_USE_API_URL = process.env.NEXT_PUBLIC_BROWSER_USE_API_URL;

  const { address, chain } = useAccount();
  const [loading, setLoading] = useState(false);
  const [task, setTask] = useState(
    "Go to https://metamask.github.io/test-dapp/ and get the connected wallet address"
  );
  const [history, setHistory] = useState<any[]>([]); // Store history array

  const handleStart = async () => {
    if (!address || !chain?.id) {
      throw new Error("Please connect your wallet first.");
    }

    setLoading(true);

    try {
      // Step 1: Post to /relayer/create
      const relayerResponse = await fetch("/relayer/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, chainId: chain.id }),
      });

      if (!relayerResponse.ok) {
        throw new Error("Failed to create relayer session.");
      }

      const { sessionId } = await relayerResponse.json();

      // Step 2: Post to BROWSER_USE_API_URL/start with task
      const startResponse = await fetch(`${BROWSER_USE_API_URL}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, task }),
      });

      if (!startResponse.ok) {
        throw new Error("Failed to start browser use session.");
      }

      const {
        result: { history },
      } = await startResponse.json();
      console.log("history", history);
      setHistory(history); // Update state to display history
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

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
                  <p className="font-medium">
                    Step {step.metadata.step_number}:
                  </p>
                  <p>{step.result[0]?.extracted_content}</p>
                  <p className="text-xs text-gray-600">
                    Success: {step.result[0]?.success ? "✅" : "❌"} | Done:{" "}
                    {step.result[0]?.is_done ? "✅" : "❌"}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
