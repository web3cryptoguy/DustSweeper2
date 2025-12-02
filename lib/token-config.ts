export interface TokenConfig {
  address: string
  symbol: string
  decimals: number
  name: string
  logoUrl: string
}

export const OUTCOME_TOKENS: Record<number, TokenConfig[]> = {
  1: [
    // Ethereum
    {
      address: "0x0000000000000000000000000000000000000000",
      symbol: "ETH",
      decimals: 18,
      name: "Ethereum",
      logoUrl: "/ethereum-logo.svg",
    },
    {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      symbol: "USDC",
      decimals: 6,
      name: "USD Coin",
      logoUrl: "/usdc-logo.svg",
    },
    {
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      symbol: "USDT",
      decimals: 6,
      name: "Tether USD",
      logoUrl: "/usdt1-logo.svg",
    },
  ],
  137: [
    // Polygon
    {
      address: "0x0000000000000000000000000000000000000000",
      symbol: "POL",
      decimals: 18,
      name: "Polygon",
      logoUrl: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png",
    },
    {
      address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      symbol: "USDC",
      decimals: 6,
      name: "USD Coin",
      logoUrl: "/usdc-logo.svg",
    },
    {
      address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      symbol: "USDT",
      decimals: 6,
      name: "Tether USD",
      logoUrl: "/usdt1-logo.svg",
    },
  ],
  56: [
    // BSC
    {
      address: "0x0000000000000000000000000000000000000000",
      symbol: "BNB",
      decimals: 18,
      name: "BNB",
      logoUrl: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png",
    },
    {
      address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      symbol: "USDC",
      decimals: 6,
      name: "USD Coin",
      logoUrl: "/usdc-logo.svg",
    },
    {
      address: "0x55d398326f99059fF775485246999027B3197955",
      symbol: "USDT",
      decimals: 18,
      name: "Tether USD",
      logoUrl: "/usdt1-logo.svg",
    },
  ],
  42161: [
    // Arbitrum
    {
      address: "0x0000000000000000000000000000000000000000",
      symbol: "ETH",
      decimals: 18,
      name: "Ethereum",
      logoUrl: "/ethereum-logo.svg",
    },
    {
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      symbol: "USDC",
      decimals: 6,
      name: "USD Coin",
      logoUrl: "/usdc-logo.svg",
    },
    {
      address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      symbol: "USDT",
      decimals: 6,
      name: "Tether USD",
      logoUrl: "/usdt1-logo.svg",
    },
  ],
  8453: [
    // Base
    {
      address: "0x0000000000000000000000000000000000000000",
      symbol: "ETH",
      decimals: 18,
      name: "Ethereum",
      logoUrl: "/ethereum-logo.svg",
    },
    {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      symbol: "USDC",
      decimals: 6,
      name: "USD Coin",
      logoUrl: "/usdc-logo.svg",
    },
    {
      address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
      symbol: "USDT",
      decimals: 6,
      name: "Tether USD",
      logoUrl: "/usdt1-logo.svg",
    },
  ],
  10: [
    // Optimism
    {
      address: "0x0000000000000000000000000000000000000000",
      symbol: "ETH",
      decimals: 18,
      name: "Ethereum",
      logoUrl: "/ethereum-logo.svg",
    },
    {
      address: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
      symbol: "USDC",
      decimals: 6,
      name: "USD Coin",
      logoUrl: "/usdc-logo.svg",
    },
    {
      address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
      symbol: "USDT",
      decimals: 6,
      name: "Tether USD",
      logoUrl: "/usdt1-logo.svg",
    },
  ],
  143: [
    // Monad
    {
      address: "0x0000000000000000000000000000000000000000",
      symbol: "MON",
      decimals: 18,
      name: "Monad",
      logoUrl: "/monad-logo.svg",
    },
    {
      address: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",
      symbol: "WMON",
      decimals: 18,
      name: "Wrapped Monad",
      logoUrl: "/monad-logo.svg",
    },
  ],
};

export function getOutcomeTokenAddress(symbol: string, chainId: number): string {
  const tokens = OUTCOME_TOKENS[chainId] || OUTCOME_TOKENS[8453]
  const token = tokens.find(t => t.symbol === symbol)
  return token?.address || OUTCOME_TOKENS[8453][0].address
}

export function getTokenSymbolFromAddress(address: string, chainId: number): string {
  // 支持简单标识符
  if (address === "native") {
    const tokens = OUTCOME_TOKENS[chainId] || OUTCOME_TOKENS[8453]
    const nativeToken = tokens.find(t => t.address === "0x0000000000000000000000000000000000000000")
    return nativeToken?.symbol || "ETH"
  }
  if (address === "usdc") {
    return "USDC"
  }
  if (address === "usdt") {
    return "USDT"
  }
  
  // 向后兼容：支持地址格式
  const tokens = OUTCOME_TOKENS[chainId] || OUTCOME_TOKENS[8453]
  const token = tokens.find(t => t.address.toLowerCase() === address.toLowerCase())
  return token?.symbol || "ETH"
}

export function getTokenLogoFromAddress(address: string, chainId: number): string {
  // 支持简单标识符
  if (address === "native") {
    const tokens = OUTCOME_TOKENS[chainId] || OUTCOME_TOKENS[8453]
    const nativeToken = tokens.find(t => t.address === "0x0000000000000000000000000000000000000000")
    return nativeToken?.logoUrl || "/ethereum-logo.svg"
  }
  if (address === "usdc") {
    return "/usdc-logo.svg"
  }
  if (address === "usdt") {
    return "/usdt1-logo.svg"
  }
  
  // 向后兼容：支持地址格式
  const tokens = OUTCOME_TOKENS[chainId] || OUTCOME_TOKENS[8453]
  const token = tokens.find(t => t.address.toLowerCase() === address.toLowerCase())
  return token?.logoUrl || `/placeholder.svg?height=32&width=32&text=${getTokenSymbolFromAddress(address, chainId)}`
}
