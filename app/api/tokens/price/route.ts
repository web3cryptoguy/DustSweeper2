import { NextRequest, NextResponse } from "next/server"
import { isAddress } from "viem"
import { getMoralisChainName } from "@/lib/config"
import { fetchMoralisJson } from "@/lib/moralis"

// Moralis API 配置
const MORALIS_BASE_URL = 'https://deep-index.moralis.io/api/v2.2'

/**
 * 获取代币价格
 * GET /api/tokens/price?tokenAddress=0x...&chainId=8453
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tokenAddress = searchParams.get('tokenAddress')
    const chainIdParam = searchParams.get('chainId')

    // Input validation
    if (!tokenAddress || !chainIdParam) {
      return NextResponse.json(
        { error: 'Missing required parameters: tokenAddress and chainId' },
        { status: 400 }
      )
    }

    if (!isAddress(tokenAddress)) {
      return NextResponse.json(
        { error: 'Invalid Ethereum address format' },
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

    // Fetch token price from Moralis API with key rotation
    const url = `${MORALIS_BASE_URL}/erc20/${tokenAddress}/price?chain=${chainName}`
    const result = await fetchMoralisJson<any>(url)
    if (!result.ok) {
      console.error('Moralis API price error:', {
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
      tokenAddress,
      chainId,
      chainName,
      usdPrice: price,
      price: price, // Alias for compatibility
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Token price API route error:', error)
    return NextResponse.json(
      { error: `Failed to fetch token price: ${errorMessage}` },
      { status: 500 }
    )
  }
}

