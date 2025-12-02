import { NextRequest, NextResponse } from "next/server"
import { isAddress } from "viem"
import { getMoralisApiKeys } from "@/lib/config"

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
    10: 'optimism',
    143: 'monad'
  }
  return chainMapping[chainId] || null
}

// 获取原生代币的包装代币地址（用于获取价格）
function getWrappedTokenAddress(chainName: string): string | null {
  const wrappedAddresses: Record<string, string> = {
    'eth': '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH (Ethereum)
    'polygon': '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC (Polygon)
    'bsc': '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB (BNB Chain)
    'arbitrum': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH (Arbitrum)
    'base': '0x4200000000000000000000000000000000000006', // WETH (Base)
    'optimism': '0x4200000000000000000000000000000000000006', // WETH (Optimism)
    'monad': '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A', // WMON (Monad)
  }
  return wrappedAddresses[chainName] || null
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const chainParam = searchParams.get('chain')
    const tokenAddress = searchParams.get('tokenAddress')
    const isNative = searchParams.get('isNative') === 'true'

    // Input validation
    if (!chainParam) {
      return NextResponse.json(
        { error: 'Missing required parameter: chain' },
        { status: 400 }
      )
    }

    // 转换链ID为 Moralis 链名称
    const chainId = parseInt(chainParam, 10)
    const chainName = !isNaN(chainId) ? getChainNameForMoralis(chainId) : chainParam.toLowerCase()

    if (!chainName) {
      return NextResponse.json(
        { error: `Unsupported chain: ${chainParam}` },
        { status: 400 }
      )
    }

    // 检查 API 密钥
    const apiKeys = getMoralisApiKeys()
    if (apiKeys.length === 0) {
      return NextResponse.json(
        { 
          error: 'Moralis API key not configured. Please set one of the following in your .env.local file: MORALIS_API_KEY, MORALIS_PRIMARY_API_KEY, MORALIS_API_KEYS, MORALIS_API_KEY_BACKUP, or MORALIS_FALLBACK_API_KEY',
          price: null
        },
        { status: 500 }
      )
    }

    // 确定要查询的代币地址
    let targetAddress: string | null = null
    if (isNative) {
      // 对于原生代币，使用包装代币地址
      targetAddress = getWrappedTokenAddress(chainName)
      if (!targetAddress) {
        return NextResponse.json(
          { error: `No wrapped token address found for chain: ${chainName}` },
          { status: 400 }
        )
      }
    } else {
      // 对于 ERC20 代币，验证地址格式
      if (!tokenAddress) {
        return NextResponse.json(
          { error: 'Missing required parameter: tokenAddress' },
          { status: 400 }
        )
      }
      if (!isAddress(tokenAddress)) {
        return NextResponse.json(
          { error: 'Invalid token address format' },
          { status: 400 }
        )
      }
      targetAddress = tokenAddress
    }

    const url = `${MORALIS_BASE_URL}/erc20/${targetAddress}/price?chain=${chainName}`

    // 尝试使用所有可用的API密钥
    let response: Response | undefined
    let lastError: unknown | undefined

    for (const apiKey of apiKeys) {
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
            break // Success, exit loop
          } else if (response.status === 401) {
            // API 密钥无效，尝试下一个
            const errorText = await response.text().catch(() => 'Unauthorized')
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
              continue
            } else {
              // 其他错误，继续尝试
              lastError = fetchError
              continue
            }
          } else {
            lastError = new Error(String(fetchError))
            continue
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        continue
      }
    }

    if (!response || !response.ok) {
      const errorDetails = lastError instanceof Error ? lastError.message : (lastError ? String(lastError) : 'All Moralis API keys failed or no response received')
      return NextResponse.json(
        { 
          error: `Failed to fetch token price: ${errorDetails}. Please check your Moralis API keys in .env.local file.`,
          price: null
        },
        { status: 500 }
      )
    }

    const data = await response.json()
    const price = parseFloat(data.usdPrice || '0')

    return NextResponse.json({
      price: price > 0 ? price : 0,
      tokenAddress: targetAddress,
      chainName,
      chainId: !isNaN(chainId) ? chainId : null,
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return NextResponse.json(
      { error: `Failed to fetch token price: ${errorMessage}`, price: 0 },
      { status: 500 }
    )
  }
}

