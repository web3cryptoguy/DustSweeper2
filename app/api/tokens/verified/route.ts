import { NextRequest, NextResponse } from "next/server"
import { SUPPORTED_CHAINS, type SupportedChainId } from "@/types"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const chainIdParam = searchParams.get('chainId')
    const limit = searchParams.get('limit') || '1000'
    const listedOnly = searchParams.get('listed_only') === 'true'

    // Input validation
    if (!chainIdParam) {
      return NextResponse.json(
        { error: 'Missing required parameter: chainId' },
        { status: 400 }
      )
    }

    const chainId = parseInt(chainIdParam) as SupportedChainId
    
    if (!Object.values(SUPPORTED_CHAINS).includes(chainId)) {
      return NextResponse.json(
        { error: 'Unsupported chain ID' },
        { status: 400 }
      )
    }

    if (isNaN(parseInt(limit)) || parseInt(limit) <= 0) {
      return NextResponse.json(
        { error: 'Invalid limit parameter' },
        { status: 400 }
      )
    }

    // Return empty tokens list - the app will rely on Moralis API's spam detection
    // (via the `exclude_spam=true` parameter and `possible_spam` field)
    
    return NextResponse.json({
      tokens: [],
      message: 'Using Moralis spam detection for token verification.'
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Verified tokens API route error:', error)
    
    // Return empty list instead of error to prevent blocking the app
    return NextResponse.json({
      tokens: [],
      error: `Failed to fetch verified tokens: ${errorMessage}`,
      message: 'Using fallback mode: relying on Moralis spam detection'
    })
  }
}