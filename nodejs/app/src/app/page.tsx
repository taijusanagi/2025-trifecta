"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { useAccount } from "wagmi";

export default function Home() {
  const BROWSER_USE_API_URL = process.env.NEXT_PUBLIC_BROWSER_USE_API_URL;

  const { address, chain, isConnected } = useAccount();
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    if (!address || !chain?.id) {
      alert("Please connect your wallet first.");
      return;
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

      // Step 2: Post to BROWSER_USE_API_URL/start
      const startResponse = await fetch(`${BROWSER_USE_API_URL}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (!startResponse.ok) {
        throw new Error("Failed to start browser use session.");
      }

      alert("Session started successfully!");
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <header className="mb-4">
        <ConnectButton />
      </header>
      <main className="flex flex-col items-center gap-4">
        <Button onClick={handleStart} disabled={loading}>
          {loading ? "Starting..." : "Start"}
        </Button>
      </main>
    </div>
  );
}
