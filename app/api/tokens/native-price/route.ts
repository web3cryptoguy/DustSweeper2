import { NextRequest, NextResponse } from "next/server"
import { getMoralisChainName } from "@/lib/config"
import { fetchMoralisJson } from "@/lib/moralis"

// Moralis API 配置
const MORALIS_BASE_URL = 'https://deep-index.moralis.io/api/v2.2'

// 获取原生代币价格的包装代币地址映射
const WRAPPED_TOKEN_ADDRESSES: Record<string, string> = {
  'eth': '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH (Ethereum)
  'polygon': '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC (Polygon)
  'bsc': '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB (BSC)
  'arbitrum': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH (Arbitrum)
  'base': '0x4200000000000000000000000000000000000006', // WETH (Base)
  'optimism': '0x4200000000000000000000000000000000000006', // WETH (Optimism)
  'sepolia': '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9', // WETH (Sepolia)
}

/**
 * 获取原生代币价格
 * GET /api/tokens/native-price?chainId=8453
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const chainIdParam = searchParams.get('chainId')

    // Input validation
    if (!chainIdParam) {
      return NextResponse.json(
        { error: 'Missing required parameter: chainId' },
        { status: 400 }
      )
    }

    const chainId = parseInt(chainIdParam, 10)
    if (isNaN(chainId)) {
      return NextResponse.json(
        { error: 'Invalid chainId' },
        { status: 400 }
      )
    }

    // Get Moralis chain name
    const chainName = getMoralisChainName(chainId)
    if (!chainName) {
      return NextResponse.json(
        { error: `Unsupported chain: ${chainId}` },
        { status: 400 }
      )
    }

    // Get wrapped token address for this chain
    const wrappedAddress = WRAPPED_TOKEN_ADDRESSES[chainName]
    if (!wrappedAddress) {
      return NextResponse.json(
        { error: `No wrapped token address found for chain: ${chainName}` },
        { status: 400 }
      )
    }

    // Fetch native token price using wrapped token (with key rotation)
    const url = `${MORALIS_BASE_URL}/erc20/${wrappedAddress}/price?chain=${chainName}`
    const result = await fetchMoralisJson<any>(url)
    if (!result.ok) {
      console.error('Moralis API native price error:', {
        status: result.status,
        statusText: result.statusText,
        url,
        errorText: result.errorText,
      })
      return NextResponse.json(
        { error: `Moralis API Error: ${result.status} ${result.statusText}` },
        { status: result.status }
      )
    }

    const data = result.data
    const price = parseFloat(data.usdPrice || '0')

    return NextResponse.json({
      chainId,
      chainName,
      usdPrice: price,
      price: price, // Alias for compatibility
      wrappedTokenAddress: wrappedAddress,
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Native token price API route error:', error)
    return NextResponse.json(
      { error: `Failed to fetch native token price: ${errorMessage}` },
      { status: 500 }
    )
  }
}

