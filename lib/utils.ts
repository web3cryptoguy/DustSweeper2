import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { getAddress, formatUnits, isAddress, type Address } from "viem"
import { getTrustWalletChainName } from "@/lib/config"
import type { SupportedChainId } from "@/types"
import { EXPLORER_URLS } from "@/types"

export function cn(...inputs: ClassValue) {
  return twMerge(clsx(inputs))
}

export function formatTokenAmount(amount: number, decimals: number = 18): string {
  if (amount === 0) return "0"
  
  // Convert from wei to token units if needed
  const tokenAmount = Number(formatUnits(BigInt(amount), decimals))
  
  // For very small amounts, show more precision
  if (tokenAmount < 0.001) {
    return tokenAmount.toExponential(2)
  }
  
  // For amounts less than 1, show up to 6 decimal places
  if (tokenAmount < 1) {
    return tokenAmount.toFixed(6).replace(/\.?0+$/, "")
  }
  
  // For larger amounts, show up to 4 decimal places
  if (tokenAmount < 1000) {
    return tokenAmount.toFixed(4).replace(/\.?0+$/, "")
  }
  
  // For very large amounts, use compact notation
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2
  }).format(tokenAmount)
}

export function formatUsdValue(value: number): string {
  if (value === 0) return "$0.00"
  
  // For very small values, show more precision
  if (value < 0.01) {
    return `$${value.toFixed(4)}`
  }
  
  return `$${value.toFixed(2)}`
}

export function getTokenLogoUrl(
  token: {
    logo_urls?: { token_logo_url?: string }
    logo_url?: string
    contract_address: Address | string
    contract_ticker_symbol?: string
    native_token?: boolean
  },
  chainId: SupportedChainId
): string {
  // Handle native tokens (ETH, BNB, POL, etc.)
  const isNativeToken = token.native_token || token.contract_address === '0x0000000000000000000000000000000000000000'
  
  if (isNativeToken) {
    // Use chain-specific native token logos
    const nativeTokenLogos: Record<SupportedChainId, string> = {
      1: '/ethereum-logo.svg',      // Ethereum
      137: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png', // Polygon
      56: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png', // BSC
      42161: '/ethereum-logo.svg',  // Arbitrum (uses ETH)
      8453: '/ethereum-logo.svg',   // Base (uses ETH)
      10: '/ethereum-logo.svg',     // Optimism (uses ETH)
    }
    
    const nativeLogo = nativeTokenLogos[chainId]
    if (nativeLogo) {
      return nativeLogo
    }
  }

  // Try to use token logo URLs from API (Moralis format)
  const tokenLogoUrl = token.logo_urls?.token_logo_url || token.logo_url

  if (tokenLogoUrl && tokenLogoUrl.trim() !== "" && tokenLogoUrl !== 'null') {
    return tokenLogoUrl
  }

  // Fallback to Trust Wallet URLs (skip for native tokens)
  if (!isNativeToken) {
    const chainName = getTrustWalletChainName(chainId)

    if (chainName && token.contract_address && isAddress(token.contract_address)) {
      const trustWalletUrl = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chainName}/assets/${getAddress(
        token.contract_address
      )}/logo.png`
      return trustWalletUrl
    }
  }

  // Final fallback to placeholder
  return `/placeholder.svg?height=32&width=32&text=${
    token.contract_ticker_symbol || "TOKEN"
  }`
}

export function getExplorerUrl(txHash: string, chainId: SupportedChainId): string {
  const baseUrl = EXPLORER_URLS[chainId] || EXPLORER_URLS[8453] // Default to Base
  return `${baseUrl}/tx/${txHash}`
}
