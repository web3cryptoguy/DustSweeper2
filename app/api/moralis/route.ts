import { NextRequest, NextResponse } from "next/server"
import { isAddress } from "viem"
import { getAllApiKeys } from "@/lib/config"

// Moralis API 配置
const MORALIS_BASE_URL = process.env.MORALIS_BASE_URL || 'https://deep-index.moralis.io/api/v2.2'

// 获取Moralis API支持的链名称
function getChainNameForMoralis(chainId: number): string | null {
  const chainMapping: Record<number, string> = {
    1: 'eth',
    137: 'polygon',
    56: 'bsc',
    42161: 'arbitrum',
    8453: 'base',
    10: 'optimism'
  }
  return chainMapping[chainId] || null
}

// 从链名称字符串转换为链ID（用于向后兼容）
function getChainIdFromName(chainName: string): number | null {
  const nameMapping: Record<string, number> = {
    'base-mainnet': 8453,
    'optimism-mainnet': 10,
    'base': 8453,
    'optimism': 10,
    'eth': 1,
    'polygon': 137,
    'bsc': 56,
    'arbitrum': 42161,
  }
  return nameMapping[chainName.toLowerCase()] || null
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const chainParam = searchParams.get('chain')
    const address = searchParams.get('address')

    // Input validation
    if (!chainParam || !address) {
      return NextResponse.json(
        { error: 'Missing required parameters: chain and address' },
        { status: 400 }
      )
    }

    if (!isAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid Ethereum address format' },
        { status: 400 }
      )
    }

    // 转换链名称或链ID为 Moralis 链名称
    let chainName: string | null = null
    const chainId = parseInt(chainParam, 10)
    
    if (!isNaN(chainId)) {
      // 如果是数字，直接使用链ID
      chainName = getChainNameForMoralis(chainId)
    } else {
      // 如果是字符串，先转换为链ID再获取链名称
      const id = getChainIdFromName(chainParam)
      if (id) {
        chainName = getChainNameForMoralis(id)
      } else {
        // 尝试直接使用（可能是已经正确的格式）
        chainName = chainParam.toLowerCase()
      }
    }

    if (!chainName) {
      return NextResponse.json(
        { error: `Unsupported chain: ${chainParam}` },
        { status: 400 }
      )
    }

    // 检查 API 密钥
    const allApiKeys = getAllApiKeys()
    if (allApiKeys.length === 0) {
      return NextResponse.json(
        { 
          error: 'Moralis API key not configured. Please set one of the following in your .env.local file: MORALIS_API_KEY, MORALIS_PRIMARY_API_KEY, MORALIS_API_KEYS, MORALIS_API_KEY_BACKUP, or MORALIS_FALLBACK_API_KEY' 
        },
        { status: 500 }
      )
    }

    const url = `${MORALIS_BASE_URL}/${address}/erc20?chain=${chainName}&limit=100&exclude_spam=true&exclude_unverified_contracts=true`

    // 尝试使用所有可用的 API 密钥，按顺序尝试
    let response: Response | null = null
    let lastError: Error | null = null
    let apiKeyUsed = ''

    for (const apiKey of allApiKeys) {
      try {
        // 创建带超时的 fetch 请求
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30秒超时

        const options: RequestInit = {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'X-API-Key': apiKey
          },
          signal: controller.signal
        }

        try {
          response = await fetch(url, options)
          clearTimeout(timeoutId)

          if (response.ok) {
            apiKeyUsed = apiKey
            break
          } else if (response.status === 401) {
            // API 密钥无效，尝试下一个
            const errorText = await response.text().catch(() => 'Unauthorized')
            console.warn(`API key failed with 401, trying next key`)
            lastError = new Error(`API key unauthorized (401)`)
            continue
          } else {
            // 其他错误，尝试下一个密钥
            const errorText = await response.text().catch(() => response.statusText)
            lastError = new Error(`Moralis API request failed: ${response.status} ${response.statusText}`)
            continue
          }
        } catch (fetchError) {
          clearTimeout(timeoutId)
          if (fetchError instanceof Error) {
            if (fetchError.name === 'AbortError') {
              lastError = new Error('Request timeout after 30 seconds')
            } else if (fetchError.message.includes('socket') || fetchError.message.includes('ECONNRESET') || fetchError.message.includes('connection')) {
              // 网络连接错误，尝试下一个密钥
              lastError = new Error(`Network error: ${fetchError.message}`)
              console.warn(`Network error with API key, trying next:`, fetchError.message)
              continue
            } else {
              // 其他错误，继续尝试
              lastError = fetchError
              console.warn(`API key attempt failed, trying next:`, fetchError.message)
              continue
            }
          } else {
            lastError = new Error(String(fetchError))
            continue
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.warn(`API key attempt failed, trying next:`, lastError.message)
        continue
      }
    }

    if (!response || !response.ok) {
      const errorMessage = lastError?.message || 'All API keys failed'
      const errorDetails = lastError instanceof Error ? lastError.message : String(lastError)
      console.error('Moralis API request error:', errorDetails)
      return NextResponse.json(
        { 
          error: `Failed to fetch token balances: ${errorDetails}. Please check your Moralis API keys in .env.local file.` 
        },
        { status: 500 }
      )
    }

    const data = await response.json()

    // 处理不同的响应格式
    let assets = []
    if (data.result) {
      assets = data.result
    } else if (Array.isArray(data)) {
      assets = data
    } else if (data.data) {
      assets = data.data
    }

    // 转换 Moralis 格式到项目期望的格式
    const items = assets.map((asset: any) => {
      // 处理余额格式
      let balanceValue = asset.balance || asset.token_balance || '0'
      if (typeof balanceValue === 'string') {
        balanceValue = balanceValue.replace(/\s/g, '')
        if (balanceValue.includes('e') || balanceValue.includes('E')) {
          const num = parseFloat(balanceValue)
          balanceValue = num.toFixed(0)
        }
      }

      // 处理小数位
      const decimals = typeof asset.decimals === 'string'
        ? parseInt(asset.decimals, 10)
        : (asset.decimals || asset.token_decimals || 18)

      // 处理 logo
      const logoUrls = asset.logo_urls || {}
      const logo = asset.logo || asset.thumbnail || logoUrls.token_logo_url || null

      // 计算 USD 价值（如果有价格信息）
      const price = asset.usd_price || asset.price || 0
      const balanceNum = parseFloat(balanceValue) / Math.pow(10, decimals)
      const quote = price * balanceNum

      return {
        contract_address: asset.token_address || asset.address,
        contract_name: asset.name || asset.token_name || 'Unknown Token',
        contract_ticker_symbol: asset.symbol || asset.token_symbol || '???',
        contract_decimals: decimals,
        logo_urls: {
          token_logo_url: logo || `/placeholder.svg?height=40&width=40&text=${asset.symbol || '???'}`
        },
        supports_erc: ['erc20'], // Moralis 只返回 ERC20
        native_token: false,
        is_spam: asset.is_spam || false,
        balance: balanceValue,
        quote: quote,
        // 保留原始数据字段
        usd_price: price,
        balance_formatted: balanceNum.toString(),
      }
    })

    // 返回标准化的响应格式
    return NextResponse.json({
      items: items,
      // 保留一些元数据
      address: address,
      chain_name: chainName,
      chain_id: chainId || getChainIdFromName(chainParam) || null,
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Moralis API route error:', error)
    return NextResponse.json(
      { error: `Failed to fetch token balances: ${errorMessage}` },
      { status: 500 }
    )
  }
}

