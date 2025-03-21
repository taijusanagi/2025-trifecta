"use client";

import { Button } from "@/components/ui/button";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function Home() {
  return (
    <div>
      <header>
        <ConnectButton />
      </header>
      <main>
        <Button>Start</Button>
      </main>
    </div>
  );
}
