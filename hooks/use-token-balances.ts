"use client"

import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import type { Address } from "viem"
import { useVerifiedTokens } from "./use-verified-tokens"
import type { Token, ApiStatus, SupportedChainId } from "@/types"
import { APP_CONFIG } from "@/types"
import { logger } from "@/lib/logger"
import { getNativeTokenSymbol, getNativeTokenLogo, getMoralisChainName } from "@/lib/config"

// Moralis API 配置（从环境变量读取，参照参考项目）
const PRIMARY_API_KEY = process.env.NEXT_PUBLIC_MORALIS_PRIMARY_API_KEY || ''
const FALLBACK_API_KEY = process.env.NEXT_PUBLIC_MORALIS_FALLBACK_API_KEY || ''
const MORALIS_BASE_URL = process.env.NEXT_PUBLIC_MORALIS_BASE_URL || 'https://deep-index.moralis.io/api/v2.2'

// 缓存工具函数（参照参考项目）
const CACHE_PREFIX = 'asset_cache_'
const CACHE_DURATION = 60 * 60 * 1000 // 1小时（毫秒）- 参照参考项目

// 获取缓存键（参照参考项目）
const getCacheKey = (address: string, chainId: number): string => {
  return `${CACHE_PREFIX}erc20_${address.toLowerCase()}_${chainId}`
}

// 获取缓存（参照参考项目）
const getCache = <T,>(key: string): { data: T; timestamp: number } | null => {
  try {
    const cached = localStorage.getItem(key)
    if (!cached) return null
    
    const parsed = JSON.parse(cached)
    const now = Date.now()
    
    // 检查缓存是否过期
    if (now - parsed.timestamp > CACHE_DURATION) {
      localStorage.removeItem(key)
      return null
    }
    
    return parsed
  } catch (error) {
    console.warn('Failed to read cache:', error)
    return null
  }
}

// 设置缓存（参照参考项目）
const setCache = <T,>(key: string, data: T) => {
  try {
    const cacheData = {
      data,
      timestamp: Date.now()
    }
    localStorage.setItem(key, JSON.stringify(cacheData))
  } catch (error) {
    console.warn('Failed to set cache:', error)
    // 如果存储空间不足，尝试清理旧缓存（参照参考项目）
    try {
      const keys = Object.keys(localStorage)
      const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX))
      // 删除最旧的缓存（简单策略：删除前10个）
      cacheKeys.slice(0, 10).forEach(k => localStorage.removeItem(k))
      // 重试
      localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }))
    } catch (retryError) {
      console.error('Failed to store cache after cleanup:', retryError)
    }
  }
}

// Utility function to invalidate token balance cache（保留向后兼容）
export const invalidateTokenBalanceCache = () => {
  try {
    const keys = Object.keys(localStorage)
    const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX))
    cacheKeys.forEach(k => localStorage.removeItem(k))
  } catch (error) {
    console.warn('Failed to clear cache:', error)
  }
}


export function useTokenBalances(address: string | undefined, chainId: SupportedChainId) {
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiStatus, setApiStatus] = useState<ApiStatus>('untested')
  const [isInitialized, setIsInitialized] = useState(false)
  const cacheAppliedRef = useRef(false)
  
  const { isTokenVerified, loading: verifiedLoading, apiStatus: verifiedApiStatus, isReady: verificationReady, refetch: refetchVerified } = useVerifiedTokens(chainId)
  const prevAddressRef = useRef<string | undefined>(address)

  const cacheKey = useMemo(() => address && chainId ? getCacheKey(address, chainId) : '', [address, chainId])

  // 初始化时立即检查缓存，避免不必要的 loading
  useEffect(() => {
    if (!address || !chainId || !cacheKey) {
      setIsInitialized(true)
      cacheAppliedRef.current = false
      return
    }

    // 重置缓存应用标志
    cacheAppliedRef.current = false

    // 立即检查缓存
    const cached = getCache<Token[]>(cacheKey)
    if (cached !== null) {
      setTokens(cached.data)
      setApiStatus('working')
      setLoading(false)
      cacheAppliedRef.current = true
      setIsInitialized(true)
    } else {
      setIsInitialized(true)
    }
  }, [address, chainId, cacheKey])

  // Clear tokens and reset state when address changes
  useEffect(() => {
    if (prevAddressRef.current !== address) {
      setTokens([])
      setError(null)
      setApiStatus('untested')
      setIsInitialized(false)
      cacheAppliedRef.current = false
      prevAddressRef.current = address
    }
  }, [address])

  const fetchTokens = useCallback(async () => {
    if (!address) return
    
    // Wait for verified tokens to be ready before filtering
    // 但如果验证加载时间过长，仍然继续执行（使用空验证列表）
    if (!verificationReady && verifiedLoading) {
      // 验证还在加载中，等待最多 2 秒
      const maxWaitTime = 2000
      const checkInterval = 100
      let waited = 0
      
      while (!verificationReady && verifiedLoading && waited < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, checkInterval))
        waited += checkInterval
      }
      
      // 如果超时仍未就绪，继续执行（验证列表为空，所有代币都会通过验证检查）
    }

    // 只有在没有缓存或需要刷新时才设置 loading 和调用 API
    // 缓存检查已经在 useEffect 中完成，这里直接调用 API
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

      // 使用新的API端点一次性获取原生代币+ERC20信息（参照参考项目）
      const url = `${MORALIS_BASE_URL}/wallets/${address}/tokens?chain=${chainName}&exclude_spam=true&exclude_unverified_contracts=true&limit=100`
      
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
      
      // 处理响应格式：新API返回 { result: [...] }（参照参考项目）
      let assets: any[] = []
      if (data.result) {
        assets = Array.isArray(data.result) ? data.result : []
      } else if (Array.isArray(data)) {
        assets = data
      } else if (data.data) {
        assets = Array.isArray(data.data) ? data.data : []
      }
      
      // 处理资产数据：新API已经包含了价格、价值等信息（包括原生代币）（参照参考项目）
      const assetsWithPrices = assets.map((asset: any) => {
        // 处理balance字段
        let balanceValue = asset.balance || asset.balance_formatted || asset.token_balance || '0'
        
        // 如果balance是字符串，确保它是纯数字字符串
        if (typeof balanceValue === 'string') {
          balanceValue = balanceValue.replace(/\s/g, '').replace(/,/g, '')
          if (balanceValue.includes('e') || balanceValue.includes('E')) {
            const num = parseFloat(balanceValue)
            balanceValue = num.toFixed(0)
          }
        } else if (typeof balanceValue === 'number') {
          balanceValue = balanceValue.toString()
        }
        
        // 确保decimals是数字
        const decimals = typeof asset.decimals === 'string' 
          ? parseInt(asset.decimals, 10) 
          : (asset.decimals || asset.token_decimals || 18)
        
        // 处理价格和价值：新API返回的 usd_price 和 usd_value 都是数字类型（参照参考项目）
        let usdPrice: number | undefined = undefined
        let usdValue: string | undefined = undefined
        
        // 如果API返回了价格，直接使用（已经是数字类型）
        if (asset.usd_price !== undefined && asset.usd_price !== null) {
          usdPrice = typeof asset.usd_price === 'number' 
            ? asset.usd_price 
            : parseFloat(asset.usd_price.toString())
        }
        
        // 如果API返回了价值，直接使用（转换为字符串）；否则根据价格和余额计算
        if (asset.usd_value !== undefined && asset.usd_value !== null) {
          usdValue = typeof asset.usd_value === 'number' 
            ? asset.usd_value.toFixed(2) 
            : asset.usd_value.toString()
        } else if (usdPrice !== undefined && usdPrice > 0) {
          const balanceNumber = parseFloat(balanceValue) / Math.pow(10, decimals)
          usdValue = (balanceNumber * usdPrice).toFixed(2)
        }
        
        // 处理logo字段：新API可能返回 logo 或 thumbnail（参照参考项目）
        const logoUrls = asset.logo_urls || {}
        const logo = asset.logo || asset.thumbnail || null
        
        return {
          ...asset,
          token_address: asset.token_address || asset.contract_address || asset.address || '',
          symbol: asset.symbol || asset.contract_ticker_symbol || asset.token_symbol || '',
          name: asset.name || asset.contract_name || asset.token_name || '',
          balance: balanceValue,
          balance_formatted: asset.balance_formatted || balanceValue,
          token_balance: asset.token_balance || balanceValue,
          decimals: decimals,
          token_decimals: asset.token_decimals || decimals,
          usd_price: usdPrice,
          usd_value: usdValue,
          quote: parseFloat(usdValue || '0'),
          logo_urls: logoUrls,
          logo: logo,
          thumbnail: asset.thumbnail || logo,
          native_token: asset.native_token || false,
        }
      })
      
      // 过滤代币（参照参考项目的逻辑）
      const filteredTokens = assetsWithPrices
        .filter((asset: any) => {
          const balanceValue = asset.balance || asset.balance_formatted || asset.token_balance || '0'
          // 原生代币的标识：native_token === true 或 token_address === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'（参照参考项目）
          const tokenAddress = asset.token_address || asset.contract_address || ''
          const isNative = Boolean(asset.native_token) || 
            (tokenAddress && tokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')
          
          // 更宽松的ERC20检测：如果有token_address且不是原生代币，就认为是ERC20
          const hasTokenAddress = !!tokenAddress
          const isErc20 = isNative 
            ? false 
            : (Array.isArray(asset.supports_erc) && asset.supports_erc.includes("erc20")) || 
              (hasTokenAddress && tokenAddress !== "0x0000000000000000000000000000000000000000" && 
               tokenAddress.toLowerCase() !== '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')
          
          const isValidTokenType = isNative || isErc20
          const quote = parseFloat(asset.usd_value || '0')
          const hasValue = quote === 0 || quote > APP_CONFIG.MIN_TOKEN_VALUE_USD
          const hasBalance = balanceValue && balanceValue !== "0" && parseFloat(balanceValue) > 0
          const isNotSpam = !asset.is_spam
          const isVerified = isNative || (tokenAddress && isTokenVerified(tokenAddress))
          
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
          
          // Ensure contract_address exists
          // 对于原生代币，使用 0x0000000000000000000000000000000000000000（参照参考项目）
          const tokenAddress = asset.token_address || asset.contract_address || ''
          const isNative = Boolean(asset.native_token) || 
            (tokenAddress && tokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')
          const contractAddress = isNative 
            ? "0x0000000000000000000000000000000000000000"
            : (tokenAddress || "0x0000000000000000000000000000000000000000")
          
          // 处理supports_erc字段，原生代币为空数组，ERC20默认为["erc20"]（参照参考项目）
          let supportsErc: string[] = isNative ? [] : ["erc20"]
          if (asset.supports_erc && !isNative) {
            if (Array.isArray(asset.supports_erc)) {
              supportsErc = asset.supports_erc.map(String)
            } else if (typeof asset.supports_erc === 'string') {
              supportsErc = [asset.supports_erc]
            }
          }
          
          // 对于原生代币，使用链特定的名称和logo（参照参考项目）
          const finalName = isNative 
            ? getNativeTokenSymbol(chainId)
            : String(asset.name || asset.contract_name || asset.token_name || "Unknown Token")
          const finalSymbol = isNative
            ? getNativeTokenSymbol(chainId)
            : String(asset.symbol || asset.contract_ticker_symbol || asset.token_symbol || "???")
          const finalLogo = isNative && !logoUrl
            ? getNativeTokenLogo(chainId)
            : (logoUrl || `/placeholder.svg?height=40&width=40&text=${finalSymbol}`)
          
          return {
            contract_address: String(contractAddress) as Address,
            contract_name: finalName,
            contract_ticker_symbol: finalSymbol,
            contract_decimals: Number(asset.decimals || asset.token_decimals || 18),
            logo_urls: {
              token_logo_url: finalLogo
            },
            supports_erc: supportsErc,
            native_token: isNative,
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

      if (filteredTokens.length === 0) {
        setError("No tokens found in this wallet")
      }
      
      setTokens(filteredTokens)
      cacheAppliedRef.current = true
      
      // 更新缓存（即使为空数组也缓存）（参照参考项目）
      if (cacheKey) {
        setCache(cacheKey, filteredTokens)
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      console.error('Failed to fetch token information:', {
        error: errorMessage,
        address,
        chainId,
        chainName: getMoralisChainName(chainId)
      })
      logger.apiError('GET', `${MORALIS_BASE_URL}/wallets/${address}/tokens`, err)
      
      // Provide user-friendly error messages
      let userFriendlyError = 'Failed to fetch token information. Please check your connection.'
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
  }, [address, chainId, isTokenVerified, verificationReady, cacheKey])

  // 当 address 或 chainId 变化时，立即触发数据获取
  useEffect(() => {
    if (!address || !chainId) {
      return
    }
    
    // 如果已经应用了缓存，不需要再次调用 API
    if (cacheAppliedRef.current) {
      return
    }
    
    // 如果初始化未完成，等待初始化
    if (!isInitialized) {
      return
    }
    
    // 再次检查缓存，避免重复调用
    const cached = cacheKey ? getCache<Token[]>(cacheKey) : null
    if (cached !== null) {
      // 如果已有缓存数据，且 tokens 状态为空，则使用缓存
      if (tokens.length === 0) {
        setTokens(cached.data)
        setApiStatus('working')
        setLoading(false)
        cacheAppliedRef.current = true
      }
      return
    }
    
    // 立即调用 API，不等待验证就绪
    // fetchTokens 内部会处理验证等待逻辑（最多等待 2 秒）
    fetchTokens()
  }, [fetchTokens, isInitialized, cacheKey, address, chainId, tokens.length])

  return {
    tokens,
    loading: loading || verifiedLoading,
    error,
    apiStatus,
    verificationStatus: verifiedApiStatus,
    refetch: fetchTokens,
    verificationReady,
  }
}
