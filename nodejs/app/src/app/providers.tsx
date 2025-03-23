"use client";

import { WagmiProvider, http } from "wagmi";
import { base, Chain } from "wagmi/chains";
import { testnet } from "@recallnet/chains";

import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { rainbowkitBurnerWallet } from "burner-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const config = getDefaultConfig({
  appName: "2025 Trifecta",
  projectId: "3a8170812b534d0ff9d794f19a901d64",
  chains: [base, { ...testnet, iconUrl: "/recall.jpg" }],
  wallets: [
    { groupName: "Supported Wallets", wallets: [rainbowkitBurnerWallet] },
  ],
  transports: {
    [base.id]: http(),
  },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <main>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider>{children}</RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </main>
    </div>
  );
}
