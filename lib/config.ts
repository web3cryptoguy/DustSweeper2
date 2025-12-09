import type { Token, SupportedChainId } from "@/types"
import { SUPPORTED_CHAINS } from "@/types"

/**
 * Mock token data for development/fallback
 */
export const MOCK_TOKENS: Token[] = [
  {
    contract_address: "0x21cfcfc3d8f98fc728f48341d10ad8283f6eb7ab",
    contract_name: "True",
    contract_ticker_symbol: "TRUE",
    contract_decimals: 18,
    logo_urls: {
      token_logo_url: "/placeholder.svg?height=40&width=40&text=TRUE",
    },
    supports_erc: ["erc20"],
    native_token: false,
    is_spam: false,
    balance: "1066680000000000000000000",
    quote: 124.56,
  },
  {
    contract_address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    contract_name: "USD Coin",
    contract_ticker_symbol: "USDC",
    contract_decimals: 6,
    logo_urls: {
      token_logo_url: "/placeholder.svg?height=40&width=40&text=USDC",
    },
    supports_erc: ["erc20"],
    native_token: false,
    is_spam: false,
    balance: "50000000",
    quote: 50.0,
  },
] as const

/**
 * Utility functions for chain operations
 */
export const getChainName = (chainId: number): string => {
  switch (chainId) {
    case SUPPORTED_CHAINS.ETHEREUM:
      return "Ethereum"
    case SUPPORTED_CHAINS.POLYGON:
      return "Polygon"
    case SUPPORTED_CHAINS.BSC:
      return "BNB Chain"
    case SUPPORTED_CHAINS.ARBITRUM:
      return "Arbitrum"
    case SUPPORTED_CHAINS.BASE:
      return "Base"
    case SUPPORTED_CHAINS.OPTIMISM:
      return "Optimism"
    case SUPPORTED_CHAINS.MONAD:
      return "Monad"
    default:
      return "Base" // Default fallback
  }
}

/**
 * Get Moralis chain name for API calls
 */
export const getMoralisChainName = (chainId: number): string => {
  switch (chainId) {
    case SUPPORTED_CHAINS.ETHEREUM:
      return "eth"
    case SUPPORTED_CHAINS.POLYGON:
      return "polygon"
    case SUPPORTED_CHAINS.BSC:
      return "bsc"
    case SUPPORTED_CHAINS.ARBITRUM:
      return "arbitrum"
    case SUPPORTED_CHAINS.BASE:
      return "base"
    case SUPPORTED_CHAINS.OPTIMISM:
      return "optimism"
    case SUPPORTED_CHAINS.MONAD:
      return "monad"
    default:
      return "base"
  }
}

export const getTrustWalletChainName = (chainId: SupportedChainId): string | null => {
  switch (chainId) {
    case SUPPORTED_CHAINS.ETHEREUM:
      return "ethereum"
    case SUPPORTED_CHAINS.POLYGON:
      return "polygon"
    case SUPPORTED_CHAINS.BSC:
      return "bsc"
    case SUPPORTED_CHAINS.ARBITRUM:
      return "arbitrum"
    case SUPPORTED_CHAINS.BASE:
      return "base"
    case SUPPORTED_CHAINS.OPTIMISM:
      return "optimism"
    case SUPPORTED_CHAINS.MONAD:
      return "monad"
    default:
      return null
  }
}

/**
 * Get native token symbol for a chain
 */
export const getNativeTokenSymbol = (chainId: number): string => {
  switch (chainId) {
    case SUPPORTED_CHAINS.ETHEREUM:
      return "ETH"
    case SUPPORTED_CHAINS.POLYGON:
      return "POL"
    case SUPPORTED_CHAINS.BSC:
      return "BNB"
    case SUPPORTED_CHAINS.ARBITRUM:
      return "ETH"
    case SUPPORTED_CHAINS.BASE:
      return "ETH"
    case SUPPORTED_CHAINS.OPTIMISM:
      return "ETH"
    case SUPPORTED_CHAINS.MONAD:
      return "MON"
    default:
      return "ETH"
  }
}

/**
 * Get native token logo URL for a chain
 * For chains where native token is ETH, use Ethereum logo instead of chain logo
 */
export const getNativeTokenLogo = (chainId: number): string => {
  const nativeTokenSymbol = getNativeTokenSymbol(chainId)
  
  // If native token is ETH, always use Ethereum logo
  if (nativeTokenSymbol === 'ETH') {
    return '/ethereum-logo.svg'
  }
  
  // For other native tokens, use chain-specific logos
  const logos: Record<number, string> = {
    [SUPPORTED_CHAINS.ETHEREUM]: '/ethereum-logo.svg',
    [SUPPORTED_CHAINS.POLYGON]: '/polygon-logo.svg',
    [SUPPORTED_CHAINS.BSC]: '/bnb-logo.svg',
    [SUPPORTED_CHAINS.ARBITRUM]: '/ethereum-logo.svg', // ETH on Arbitrum
    [SUPPORTED_CHAINS.BASE]: '/ethereum-logo.svg', // ETH on Base
    [SUPPORTED_CHAINS.OPTIMISM]: '/ethereum-logo.svg', // ETH on Optimism
    [SUPPORTED_CHAINS.MONAD]: '/monad-logo.svg', // MON on Monad
  }
  return logos[chainId] || '/ethereum-logo.svg'
}

/**
 * Environment variables with proper typing
 */
export interface ServerEnvironmentConfig {
  moralisApiKey?: string
}

export const getServerConfig = (): ServerEnvironmentConfig => ({
  moralisApiKey: process.env.MORALIS_API_KEY,
})

/**
 * Read Moralis API keys with support for backups.
 * Priority:
 * 1) MORALIS_API_KEYS (comma-separated)
 * 2) MORALIS_PRIMARY_API_KEY or MORALIS_API_KEY (primary)
 * 3) MORALIS_FALLBACK_API_KEY or MORALIS_API_KEY_BACKUP (backup)
 */
export const getMoralisApiKeys = (): string[] => {
  const keysFromList = (process.env.MORALIS_API_KEYS || "")
    .split(",")
    .map(k => k.trim())
    .filter(k => k.length > 0)

  // Support multiple environment variable names for primary key
  const primary = process.env.MORALIS_PRIMARY_API_KEY || process.env.MORALIS_API_KEY
  // Support multiple environment variable names for backup key
  const backup = process.env.MORALIS_FALLBACK_API_KEY || process.env.MORALIS_API_KEY_BACKUP

  const result = [
    ...keysFromList,
    ...(primary ? [primary] : []),
    ...(backup ? [backup] : []),
  ]

  // De-duplicate while preserving order
  return Array.from(new Set(result))
}

/**
 * Alias for getMoralisApiKeys for backward compatibility
 */
export const getAllApiKeys = getMoralisApiKeys


/**
 * Get Infura API key (client-side)
 * Note: This should only be used in client components
 */
export const getInfuraApiKey = (): string | null => {
  if (typeof window === 'undefined') return null
  return process.env.NEXT_PUBLIC_INFURA_API_KEY || null
}

/**
 * Get Infura RPC URL for a chain
 * Priority: Infura > Default public RPC
 */
export const getInfuraRpcUrl = (chainId: number, apiKey?: string): string | null => {
  const key = apiKey || (typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_INFURA_API_KEY : null)
  if (!key) return null

  const networkNames: Record<number, string> = {
    [SUPPORTED_CHAINS.ETHEREUM]: 'mainnet',
    [SUPPORTED_CHAINS.POLYGON]: 'polygon-mainnet',
    [SUPPORTED_CHAINS.BSC]: 'bsc-mainnet',
    [SUPPORTED_CHAINS.ARBITRUM]: 'arbitrum-mainnet',
    [SUPPORTED_CHAINS.BASE]: 'base-mainnet',
    [SUPPORTED_CHAINS.OPTIMISM]: 'optimism-mainnet',
    [SUPPORTED_CHAINS.MONAD]: 'monad-mainnet',
  }

  const networkName = networkNames[chainId]
  if (!networkName) return null

  return `https://${networkName}.infura.io/v3/${key}`
}