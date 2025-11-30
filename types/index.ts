import type { Address, Hash, Hex } from "viem"

/**
 * Configuration constants
 */
export const APP_CONFIG = {
  SLIPPAGE_TOLERANCE: 0.01, // 1% slippage
  CACHE_TTL: 2 * 60 * 1000, // 2 minutes - standardized across all hooks
  MIN_TOKEN_VALUE_USD: 0.01, // Minimum $0.01 value
} as const

/**
 * Chain configuration
 */
export const SUPPORTED_CHAINS = {
  ETHEREUM: 1,
  POLYGON: 137,
  BSC: 56,
  ARBITRUM: 42161,
  BASE: 8453,
  OPTIMISM: 10,
} as const

export type SupportedChainId = (typeof SUPPORTED_CHAINS)[keyof typeof SUPPORTED_CHAINS]

/**
 * Token interface - used across all components and hooks
 */
export interface Token {
  contract_address: Address
  contract_name: string
  contract_ticker_symbol: string
  contract_decimals: number
  logo_urls: {
    token_logo_url: string
  }
  supports_erc: string[]
  native_token: boolean
  is_spam: boolean
  balance: string
  quote: number
  usd_price?: number
}

/**
 * API status types
 */
export type ApiStatus = 'untested' | 'working' | 'failed'

/**
 * Swap quote interface with proper Viem types
 */
export interface SwapQuote {
  input: {
    token: {
      address: Address
      symbol: string
      decimals: number
    }
    amount: number
    amount_wei: string
    price_usd: number
    value_usd: number
  }
  output: {
    token: {
      address: Address
      symbol: string
      decimals: number
    }
    amount: number
    amount_wei: string
    min_amount: number
    min_amount_wei: string
    price_usd: number
    value_usd: number
  }
  route: {
    path: Array<{
      pool_address: Address
      is_stable: boolean
      is_cl: boolean
      hop_number: number
    }>
    hops: number
    type: string
  }
  execution_price: number
  slippage: number
  route_found?: boolean
  price_impact?: number
  gas_estimate?: string
}

/**
 * Swap call interface with proper Viem types
 */
export interface SwapCall {
  to: Address
  data: Hex
  value: bigint
}

/**
 * Swap build parameters
 */
export interface SwapBuildParams {
  from_token: Address
  to_token: Address
  amount: string
  wallet_address: Address
  slippage: number
}

/**
 * Environment validation result
 */
export interface EnvironmentConfig {
  walletConnectProjectId?: string
}

export interface ValidationResult {
  isValid: boolean
  warnings: string[]
  errors: string[]
  config: EnvironmentConfig
}

/**
 * Outcome token interface
 */
export interface OutcomeToken {
  address: Address
  symbol: string
  name: string
  decimals: number
  logo_url?: string
}

/**
 * Swap result interface
 */
export interface SwapResult {
  tokensSwapped: number
  totalValue: number
  outcomeToken: string // 支持简单标识符（"native", "usdc"）或地址
  chain: string
  txHash: Hash
  chainId: SupportedChainId
  isAtomic: boolean
}

/**
 * Chain names mapping
 */
export const CHAIN_NAMES: Record<SupportedChainId, string> = {
  [SUPPORTED_CHAINS.ETHEREUM]: "Ethereum",
  [SUPPORTED_CHAINS.POLYGON]: "Polygon",
  [SUPPORTED_CHAINS.BSC]: "BSC",
  [SUPPORTED_CHAINS.ARBITRUM]: "Arbitrum",
  [SUPPORTED_CHAINS.BASE]: "Base",
  [SUPPORTED_CHAINS.OPTIMISM]: "Optimism",
} as const

/**
 * Explorer URLs
 */
export const EXPLORER_URLS: Record<SupportedChainId, string> = {
  [SUPPORTED_CHAINS.ETHEREUM]: "https://etherscan.io",
  [SUPPORTED_CHAINS.POLYGON]: "https://polygonscan.com",
  [SUPPORTED_CHAINS.BSC]: "https://bscscan.com",
  [SUPPORTED_CHAINS.ARBITRUM]: "https://arbiscan.io",
  [SUPPORTED_CHAINS.BASE]: "https://basescan.org",
  [SUPPORTED_CHAINS.OPTIMISM]: "https://optimistic.etherscan.io",
} as const

/**
 * Chain identifiers for Trust Wallet assets
 */
export const TRUST_WALLET_CHAIN_NAMES: Record<SupportedChainId, string> = {
  [SUPPORTED_CHAINS.ETHEREUM]: "ethereum",
  [SUPPORTED_CHAINS.POLYGON]: "polygon",
  [SUPPORTED_CHAINS.BSC]: "bsc",
  [SUPPORTED_CHAINS.ARBITRUM]: "arbitrum",
  [SUPPORTED_CHAINS.BASE]: "base",
  [SUPPORTED_CHAINS.OPTIMISM]: "optimism",
} as const
