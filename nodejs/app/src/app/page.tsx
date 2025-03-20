"use client";
import "@rainbow-me/rainbowkit/styles.css";

import { WagmiProvider, http } from "wagmi";
import { mainnet } from "wagmi/chains";

import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { rainbowkitBurnerWallet } from "burner-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ConnectButton } from "@rainbow-me/rainbowkit";

const config = getDefaultConfig({
  appName: "2025 Trifecta",
  projectId: "3a8170812b534d0ff9d794f19a901d64",
  chains: [mainnet],
  wallets: [
    { groupName: "Supported Wallets", wallets: [rainbowkitBurnerWallet] },
  ],
  transports: {
    [mainnet.id]: http(),
  },
});

const queryClient = new QueryClient();

export default function Home() {
  return (
    <div>
      <main>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider>
              <ConnectButton />
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </main>
    </div>
  );
}
