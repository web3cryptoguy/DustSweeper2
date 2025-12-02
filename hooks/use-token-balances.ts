"use client"

import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import type { Address } from "viem"
import { useBalance } from "wagmi"
import { useVerifiedTokens } from "./use-verified-tokens"
import type { Token, ApiStatus, SupportedChainId } from "@/types"
import { APP_CONFIG } from "@/types"
import { logger } from "@/lib/logger"
import { getNativeTokenSymbol, getNativeTokenLogo, getMoralisChainName } from "@/lib/config"

// Moralis API 配置（从环境变量读取，参照参考项目）
const PRIMARY_API_KEY = process.env.NEXT_PUBLIC_MORALIS_PRIMARY_API_KEY || ''
const FALLBACK_API_KEY = process.env.NEXT_PUBLIC_MORALIS_FALLBACK_API_KEY || ''
const MORALIS_BASE_URL = process.env.NEXT_PUBLIC_MORALIS_BASE_URL || 'https://deep-index.moralis.io/api/v2.2'

// Cache to prevent duplicate API calls with versioning
interface TokenCacheEntry {
  data: Token[]
  timestamp: number
  version: number
}

const cache = new Map<string, TokenCacheEntry>()
let tokenCacheVersion = 1

// Utility function to invalidate token balance cache
export const invalidateTokenBalanceCache = () => {
  tokenCacheVersion++
}

// 获取代币价格（参照参考项目）
async function fetchTokenPrice(tokenAddress: string, chainName: string, apiKey: string): Promise<number | null> {
  try {
    const url = `${MORALIS_BASE_URL}/erc20/${tokenAddress}/price?chain=${chainName}`
    const options = {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'X-API-Key': apiKey
      }
    }
    
    const response = await fetch(url, options)
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    return parseFloat(data.usdPrice || '0')
  } catch (error) {
    console.error('Failed to fetch token price:', error)
    return null
  }
}

// 获取原生代币价格（参照参考项目：通过包装代币地址获取）
async function fetchNativeTokenPrice(chainName: string, apiKey: string): Promise<number | null> {
  try {
    // 对于不同的链，使用不同的包装代币地址来获取原生代币价格
    const wrappedTokenAddresses: Record<string, string> = {
      'eth': '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH (Ethereum)
      'polygon': '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC (Polygon)
      'bsc': '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB (BNB Chain)
      'arbitrum': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH (Arbitrum)
      'base': '0x4200000000000000000000000000000000000006', // WETH (Base)
      'optimism': '0x4200000000000000000000000000000000000006', // WETH (Optimism)
      'monad': '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A', // WMON (Monad)
    }
    
    const wrappedAddress = wrappedTokenAddresses[chainName]
    if (!wrappedAddress) {
      return null
    }
    
    const url = `${MORALIS_BASE_URL}/erc20/${wrappedAddress}/price?chain=${chainName}`
    const options = {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'X-API-Key': apiKey
      }
    }
    
    const response = await fetch(url, options)
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    const price = parseFloat(data.usdPrice || '0')
    return price > 0 ? price : null
  } catch (error) {
    console.error('Failed to fetch native token price:', error)
    return null
  }
}

export function useTokenBalances(address: string | undefined, chainId: SupportedChainId) {
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiStatus, setApiStatus] = useState<ApiStatus>('untested')
  const [nativeTokenPrice, setNativeTokenPrice] = useState<number | null>(null)
  
  const { isTokenVerified, loading: verifiedLoading, apiStatus: verifiedApiStatus, isReady: verificationReady } = useVerifiedTokens(chainId)
  const prevAddressRef = useRef<string | undefined>(address)
  
  // Get native token balance using wagmi
  const { data: balanceData, isLoading: balanceLoading } = useBalance({
    address: address as Address | undefined,
    chainId,
  })

  const cacheKey = useMemo(() => `${address}-${chainId}`, [address, chainId])

  // Clear tokens and reset state when address changes
  useEffect(() => {
    if (prevAddressRef.current !== address) {
      setTokens([])
      setError(null)
      setApiStatus('untested')
      prevAddressRef.current = address
    }
  }, [address])

  const fetchTokens = useCallback(async () => {
    if (!address) return
    
    // Wait for verified tokens to be ready before filtering
    if (!verificationReady) {
      return
    }

    // Check cache first (with version check)
    const cached = cache.get(cacheKey)
    let cachedTokens: Token[] = []
    let useCachedBalance = false
    
    if (cached && Date.now() - cached.timestamp < APP_CONFIG.CACHE_TTL && cached.version === tokenCacheVersion) {
      cachedTokens = cached.data
      useCachedBalance = true
    }

    setLoading(true)
    setError(null)

    try {
      const chainName = getMoralisChainName(chainId)
      if (!chainName) {
        throw new Error(`Unsupported chain: ${chainId}`)
      }

      // Check if API keys are configured
      if (!PRIMARY_API_KEY && !FALLBACK_API_KEY) {
        throw new Error('Moralis API keys are not configured. Please set NEXT_PUBLIC_MORALIS_PRIMARY_API_KEY or NEXT_PUBLIC_MORALIS_FALLBACK_API_KEY in your environment variables.')
      }

      // Directly call Moralis API to fetch token balances
      const url = `${MORALIS_BASE_URL}/${address}/erc20?chain=${chainName}&limit=100&exclude_spam=true&exclude_unverified_contracts=true`
      
      // Try primary API key first, fallback to secondary key
      let response: Response
      let currentApiKey: string
      
      try {
        if (!PRIMARY_API_KEY) {
          throw new Error('Primary API key not configured')
        }

        const options = {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'X-API-Key': PRIMARY_API_KEY
          }
        }
        
        response = await fetch(url, options)
        
        if (!response.ok) {
          throw new Error(`Primary API failed: ${response.status}`)
        }
        
        currentApiKey = PRIMARY_API_KEY
      } catch (error) {
        // Try fallback API key
        try {
          if (!FALLBACK_API_KEY) {
            throw new Error('Fallback API key not configured')
          }

          const fallbackOptions = {
            method: 'GET',
            headers: {
              'accept': 'application/json',
              'X-API-Key': FALLBACK_API_KEY
            }
          }
          
          response = await fetch(url, fallbackOptions)
          
          if (!response.ok) {
            const errorText = await response.text()
            console.error('Fallback API failed:', {
              status: response.status,
              statusText: response.statusText,
              errorText: errorText.substring(0, 200)
            })
            throw new Error(`Fallback API request failed: ${response.status} ${response.statusText}`)
          }
          
          currentApiKey = FALLBACK_API_KEY
        } catch (fallbackError) {
          const errorMessage = fallbackError instanceof Error ? fallbackError.message : 'Unknown error'
          if (errorMessage.includes('not configured') || errorMessage.includes('API key')) {
            console.error('All API keys failed - configuration issue')
            throw new Error('Moralis API keys are not configured. Please set NEXT_PUBLIC_MORALIS_PRIMARY_API_KEY or NEXT_PUBLIC_MORALIS_FALLBACK_API_KEY in your .env.local file.')
          } else if (errorMessage.includes('ERR_CONNECTION_CLOSED') || errorMessage.includes('Failed to fetch')) {
            console.error('All API keys failed - network error')
            throw new Error('Network connection failed. Please check your internet connection and try again.')
          } else {
            console.error('All API keys failed')
            throw fallbackError
          }
        }
      }

      const data = await response.json()
      
      // Handle different response formats
      let assets: any[] = []
      if (data.result) {
        assets = Array.isArray(data.result) ? data.result : []
      } else if (Array.isArray(data)) {
        assets = data
      } else if (data.data) {
        assets = Array.isArray(data.data) ? data.data : []
      } else if (data.items) {
        assets = Array.isArray(data.items) ? data.items : []
      } else if (data.tokens) {
        assets = Array.isArray(data.tokens) ? data.tokens : []
      } else if (data.assets) {
        assets = Array.isArray(data.assets) ? data.assets : []
      }
      
      // If no assets found, try using data as a single asset
      if (assets.length === 0 && data && (data.token_address || data.contract_address)) {
        assets = [data]
      }
      
      if (assets.length === 0) {
        console.warn('No ERC20 tokens found in API response')
      }
      
      // 确保balance字段是正确的格式（参照参考项目）
      assets = assets.map((asset: any) => {
        // 尝试从多个可能的字段获取余额
        let balanceValue = asset.balance || asset.balance_formatted || asset.token_balance || asset.amount || '0'
        
        // 如果balance是字符串，确保它是纯数字字符串
        if (typeof balanceValue === 'string') {
          balanceValue = balanceValue.replace(/\s/g, '').replace(/,/g, '')
          
          // 如果是科学计数法，转换为普通数字
          if (balanceValue.includes('e') || balanceValue.includes('E')) {
            const num = parseFloat(balanceValue)
            balanceValue = num.toFixed(0)
          }
        } else if (typeof balanceValue === 'number') {
          // 如果是数字，转换为字符串
          balanceValue = balanceValue.toString()
        }
        
        // 确保decimals是数字
        const decimals = typeof asset.decimals === 'string' 
          ? parseInt(asset.decimals, 10) 
          : (asset.decimals || asset.token_decimals || 18)
        
        // 确保token_address存在（从多个可能的字段获取）
        const tokenAddress = asset.token_address || asset.contract_address || asset.address
        
        // 参照参考项目：确保 logo_urls 字段被正确保留
        const logoUrls = asset.logo_urls || {}
        const logo = asset.logo || asset.thumbnail || null
        
        return {
          ...asset,
          token_address: tokenAddress || asset.token_address,
          contract_address: tokenAddress || asset.contract_address,
          balance: balanceValue,
          decimals: decimals,
          logo_urls: logoUrls,
          logo: logo,
          thumbnail: asset.thumbnail || null,
        }
      })
      
      // Fetch native token price
      try {
        const nativePrice = await fetchNativeTokenPrice(chainName, currentApiKey)
        setNativeTokenPrice(nativePrice)
      } catch (error) {
        console.error('Failed to fetch native token price:', error)
        setNativeTokenPrice(null)
      }
      
      // 为每个ERC20代币获取价格并计算价值（参照参考项目）
      const assetsWithPrices = await Promise.all(
        assets.map(async (asset: any) => {
          const balanceValue = asset.balance || asset.balance_formatted || asset.token_balance || '0'
          const decimals = asset.decimals || asset.token_decimals || 18
          const tokenAddress = asset.token_address || asset.contract_address || asset.address
          
          // 只对有效的ERC20代币获取价格
          if (tokenAddress && 
              tokenAddress !== "0x0000000000000000000000000000000000000000" && 
              asset.symbol !== "ETH" &&
              parseFloat(balanceValue) > 0) {
            try {
              const price = await fetchTokenPrice(tokenAddress, chainName, currentApiKey)
              if (price !== null && price > 0) {
                const balanceNumber = parseFloat(balanceValue) / Math.pow(10, decimals)
                const usdValue = balanceNumber * price
                
                return {
                  ...asset,
                  usd_price: price,
                  usd_value: usdValue.toFixed(2),
                  quote: usdValue
                }
              }
            } catch (error) {
              // Silently fail for individual token price fetches
            }
          }
          
          return {
            ...asset,
            quote: 0,
            usd_value: '0'
          }
        })
      )
      
      // 过滤代币（参照参考项目的逻辑）
      const filteredTokens = assetsWithPrices
        .filter((asset: any) => {
          const balanceValue = asset.balance || asset.balance_formatted || asset.token_balance || '0'
          const isNative = Boolean(asset.native_token)
          
          // 更宽松的ERC20检测：如果有token_address且不是原生代币，就认为是ERC20
          const hasTokenAddress = !!(asset.token_address || asset.contract_address)
          const isErc20 = isNative 
            ? false 
            : (Array.isArray(asset.supports_erc) && asset.supports_erc.includes("erc20")) || 
              (hasTokenAddress && asset.token_address !== "0x0000000000000000000000000000000000000000")
          
          const isValidTokenType = isNative || isErc20
          const quote = parseFloat(asset.usd_value || '0')
          const hasValue = quote === 0 || quote > APP_CONFIG.MIN_TOKEN_VALUE_USD
          const hasBalance = balanceValue && balanceValue !== "0" && parseFloat(balanceValue) > 0
          const isNotSpam = !asset.is_spam
          const isVerified = isNative || (asset.token_address && isTokenVerified(asset.token_address))
          
          if (isNative) {
            return hasBalance && isNotSpam
          }
          
          // 对于ERC20代币，如果supports_erc字段缺失，仍然允许通过（假设是ERC20）
          return isValidTokenType && hasValue && hasBalance && isNotSpam && isVerified
        })
        .map((asset: any): Token => {
          // 参照参考项目：处理 logo URL（从多个字段获取）
          const logoUrl = 
            asset.logo_urls?.token_logo_url || 
            asset.logo_urls?.logo_url || 
            asset.logo || 
            asset.thumbnail || 
            null
          
          // 处理supports_erc字段，如果缺失则默认为["erc20"]
          let supportsErc: string[] = ["erc20"]
          if (asset.supports_erc) {
            if (Array.isArray(asset.supports_erc)) {
              supportsErc = asset.supports_erc.map(String)
            } else if (typeof asset.supports_erc === 'string') {
              supportsErc = [asset.supports_erc]
            }
          }
          
          // Ensure contract_address exists
          const contractAddress = asset.token_address || asset.contract_address
          
          return {
            contract_address: String(contractAddress || "0x0000000000000000000000000000000000000000") as Address,
            contract_name: String(asset.name || asset.contract_name || asset.token_name || "Unknown Token"),
            contract_ticker_symbol: String(asset.symbol || asset.contract_ticker_symbol || asset.token_symbol || "???"),
            contract_decimals: Number(asset.decimals || asset.token_decimals || 18),
            logo_urls: {
              token_logo_url: logoUrl || `/placeholder.svg?height=40&width=40&text=${asset.symbol || asset.contract_ticker_symbol || asset.token_symbol || '???'}`
            },
            supports_erc: supportsErc,
            native_token: Boolean(asset.native_token),
            is_spam: Boolean(asset.is_spam),
            balance: String(asset.balance || asset.balance_formatted || asset.token_balance || "0"),
            quote: parseFloat(asset.usd_value || asset.quote || '0'),
            usd_price: asset.usd_price || undefined,
          }
        })
        .sort((a: Token, b: Token) => {
          // 参照参考项目：按价值降序排序
          const valueA = a.quote || 0
          const valueB = b.quote || 0
          
          if (valueA > 0 && valueB > 0) {
            return valueB - valueA
          }
          if (valueA > 0 && valueB === 0) {
            return -1
          }
          if (valueA === 0 && valueB > 0) {
            return 1
          }
          
          const balanceA = parseFloat(a.balance || '0')
          const balanceB = parseFloat(b.balance || '0')
          return balanceB - balanceA
        })

      setApiStatus('working')

      // 添加原生代币（参照参考项目）
      const allTokens: Token[] = []
      
      if (balanceData?.value !== undefined && balanceData.value !== null) {
        const nativeBalance = balanceData.value.toString()
        const nativeBalanceNum = Number(nativeBalance) / Math.pow(10, balanceData.decimals)
        const nativeQuote = nativeTokenPrice ? nativeTokenPrice * nativeBalanceNum : 0
        
        const nativeToken: Token = {
          contract_address: '0x0000000000000000000000000000000000000000' as Address,
          contract_name: getNativeTokenSymbol(chainId),
          contract_ticker_symbol: getNativeTokenSymbol(chainId),
          contract_decimals: balanceData.decimals,
          logo_urls: {
            token_logo_url: getNativeTokenLogo(chainId),
          },
          supports_erc: [],
          native_token: true,
          is_spam: false,
          balance: nativeBalance,
          quote: nativeQuote,
          usd_price: nativeTokenPrice || undefined,
        }
        
        allTokens.push(nativeToken)
      }
      
      allTokens.push(...filteredTokens)
      
      // 按价值降序排序
      allTokens.sort((a: Token, b: Token) => b.quote - a.quote)

      if (allTokens.length === 0) {
        setError("No tokens found in this wallet")
      }
      
      setTokens(allTokens)
      
      // Cache the result with version
      cache.set(cacheKey, {
        data: filteredTokens,
        timestamp: Date.now(),
        version: tokenCacheVersion
      })
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      console.error('Failed to fetch ERC20 token information:', {
        error: errorMessage,
        address,
        chainId,
        chainName: getMoralisChainName(chainId)
      })
      logger.apiError('GET', `${MORALIS_BASE_URL}/${address}/erc20`, err)
      
      // Provide user-friendly error messages
      let userFriendlyError = 'Failed to fetch ERC20 token information. Please check your connection.'
      if (errorMessage.includes('not configured') || errorMessage.includes('API key')) {
        userFriendlyError = 'Moralis API keys are not configured. Please set NEXT_PUBLIC_MORALIS_PRIMARY_API_KEY or NEXT_PUBLIC_MORALIS_FALLBACK_API_KEY in your .env.local file.'
      } else if (errorMessage.includes('API')) {
        userFriendlyError = `API request failed: ${errorMessage}`
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('ERR_CONNECTION_CLOSED')) {
        userFriendlyError = 'Network connection failed. Please check your internet connection and network settings.'
      } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
        userFriendlyError = 'API key is invalid or expired. Please check your API key configuration.'
      } else if (errorMessage.includes('429')) {
        userFriendlyError = 'API rate limit exceeded. Please try again later.'
      }
      
      setError(userFriendlyError)
      setApiStatus('failed')
      
      setTokens([])
      logger.error("API error - no tokens will be displayed")
    } finally {
      setLoading(false)
    }
  }, [address, chainId, isTokenVerified, verificationReady, cacheKey, balanceData, nativeTokenPrice])

  useEffect(() => {
    fetchTokens()
  }, [fetchTokens])

  return {
    tokens,
    loading: loading || verifiedLoading || balanceLoading,
    error,
    apiStatus,
    verificationStatus: verifiedApiStatus,
    refetch: fetchTokens,
    verificationReady,
  }
}
