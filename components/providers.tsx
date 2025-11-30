"use client";

import type React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, http, createConfig, fallback } from "wagmi";
import { metaMask } from "wagmi/connectors";
import { mainnet, polygon, bsc, arbitrum, base, optimism, sepolia } from "viem/chains";
import { getInfuraRpcUrl, getAlchemyRpcUrl } from "@/lib/config";

// API Keys for RPC endpoints (priority: Infura > Alchemy)
const INFURA_API_KEY = process.env.NEXT_PUBLIC_INFURA_API_KEY
const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY

/**
 * Get RPC transport for a chain with fallback priority:
 * 1. Infura (if API key is configured) - PRIORITY
 * 2. Alchemy (if API key is configured) - Fallback
 * 3. Default public RPC (fallback)
 */
const getRpcTransport = (chainId: number) => {
  const transports: ReturnType<typeof http>[] = []

  // Priority 1: Infura (优先使用)
  const infuraUrl = getInfuraRpcUrl(chainId, INFURA_API_KEY || undefined)
  if (infuraUrl) {
    transports.push(http(infuraUrl))
  }

  // Priority 2: Alchemy (备用)
  const alchemyUrl = getAlchemyRpcUrl(chainId, ALCHEMY_API_KEY || undefined)
  if (alchemyUrl) {
    transports.push(http(alchemyUrl))
  }

  // Priority 3: Default public RPC (fallback)
  // Always add default RPC as final fallback
  transports.push(http())

  // Use fallback to try multiple RPCs in order
  return fallback(transports)
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// 支持的所有链，为 Ethereum 和 Sepolia 添加自定义 logo
const supportedChains = [
  {
    ...mainnet,
    iconUrl: '/ethereum-logo.svg',
  },
  polygon,
  bsc,
  arbitrum,
  base,
  optimism,
  {
    ...sepolia,
    iconUrl: '/ethereum2-logo.svg',
  },
] as const;

// 只配置 MetaMask 钱包
export const connectors = [
  metaMask({
    infuraAPIKey: INFURA_API_KEY,
  }),
];

export const config = createConfig({
  chains: supportedChains,
  connectors,
  multiInjectedProviderDiscovery: false,
  ssr: true,
  transports: {
    [mainnet.id]: getRpcTransport(mainnet.id),
    [polygon.id]: getRpcTransport(polygon.id),
    [bsc.id]: getRpcTransport(bsc.id),
    [arbitrum.id]: getRpcTransport(arbitrum.id),
    [base.id]: getRpcTransport(base.id),
    [optimism.id]: getRpcTransport(optimism.id),
    [sepolia.id]: getRpcTransport(sepolia.id),
  },
});

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        {children}
      </WagmiProvider>
    </QueryClientProvider>
  );
}
