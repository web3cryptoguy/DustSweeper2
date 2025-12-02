"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Wallet, Sparkles, ArrowRight, CheckCircle2, ChevronDown, Network } from "lucide-react"
import TokenPortfolio from "@/components/token-portfolio"
import SwapConfiguration from "@/components/swap-configuration"
import SocialCard from "@/components/social-card"
import EIP7702Info from "@/components/eip-7702-info"
import Footer from "@/components/footer"
import { useAccount, useChainId, useCapabilities, useAccountEffect, useConnect, useDisconnect, useSwitchChain } from "wagmi"
import { metaMask } from "wagmi/connectors"
import { Address, Hash } from "viem"
import { useTokenBalances } from "@/hooks/use-token-balances"
import { validateEnvironment, logEnvironmentStatus } from "@/lib/env-validation"
import { getChainName, getNativeTokenSymbol, getNativeTokenLogo } from "@/lib/config"
import type { SupportedChainId, SwapResult } from "@/types"
import { APP_CONFIG } from "@/types"

// 获取链的logo URL（从public目录加载）
const getChainLogo = (chainId: number): string => {
  switch (chainId) {
    case 1: // Ethereum
      return '/ethereum-logo.svg'
    case 11155111: // Sepolia
      return '/sepolia-logo.svg'
    case 137: // Polygon
      return '/polygon-logo.svg'
    case 56: // BSC
      return '/bnb-logo.svg'
    case 42161: // Arbitrum
      return '/arbitrum-logo.svg'
    case 8453: // Base
      return '/base-logo.svg'
    case 10: // Optimism
      return '/optimism-logo.svg'
    case 143: // Monad
      return '/monad-logo.svg'
    default:
      return '/placeholder.svg'
  }
}

// 格式化钱包地址（截断显示）
const formatAddress = (address: string): string => {
  if (!address) return ""
  if (address.length <= 10) return address
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

// Mobile device detection
const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

// MetaMask browser detection
const isInMetaMaskBrowser = (): boolean => {
  if (typeof window === 'undefined') return false
  return !!(window as any).ethereum?.isMetaMask
}

export default function DustSweeperApp() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { data: capabilities } = useCapabilities({ account: address })
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const [isMobile, setIsMobile] = useState(false)
  const [isInMetaMask, setIsInMetaMask] = useState(false)

  const { tokens, loading, refetch, apiStatus, error: tokenError } = useTokenBalances(address, chainId as SupportedChainId)
  const [selectedTokens, setSelectedTokens] = useState<string[]>([])
  const [outcomeToken, setOutcomeToken] = useState("")
  const [swapStep, setSwapStep] = useState<"select" | "configure" | "execute" | "success">("select")
  const [swapResult, setSwapResult] = useState<SwapResult | null>(null)
  const [envStatus, setEnvStatus] = useState<ReturnType<typeof validateEnvironment> | null>(null)
  const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false)
  const tokenDropdownRef = useRef<HTMLDivElement>(null)

  // Check if atomic batch is supported
  const atomicSupported =
    capabilities?.[chainId]?.atomic?.status === "supported" ||
    capabilities?.[chainId]?.atomic?.status === "ready";

  // Validate environment on mount
  useEffect(() => {
    const result = logEnvironmentStatus()
    setEnvStatus(result)
    
    // Show user-friendly warnings for missing configuration
    if (!result.isValid) {
      console.warn('Production configuration incomplete. Some features may use mock data.')
    }
  }, [])

  // Mobile and MetaMask detection
  useEffect(() => {
    setIsMobile(isMobileDevice())
    setIsInMetaMask(isInMetaMaskBrowser())

    const checkMetaMask = () => {
      setIsInMetaMask(isInMetaMaskBrowser())
    }
    window.addEventListener('ethereum#initialized', checkMetaMask, { once: true })
    return () => window.removeEventListener('ethereum#initialized', checkMetaMask)
  }, [])

  // Note: useTokenBalances hook automatically fetches tokens when address or chainId changes
  // No need to manually call refetch here to avoid duplicate API calls

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tokenDropdownRef.current && !tokenDropdownRef.current.contains(event.target as Node)) {
        setIsTokenDropdownOpen(false)
      }
    }

    if (isTokenDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isTokenDropdownOpen])

  // Handle account connection/disconnection events
  useAccountEffect({
    onConnect() {
    },
    onDisconnect() {
      setSelectedTokens([])
      setOutcomeToken("")
      setSwapResult(null) 
      setSwapStep("select")
    },
  })


  // Clear state when wallet address changes
  useEffect(() => {
    setSelectedTokens([])
    setOutcomeToken("")
    setSwapResult(null)
    setSwapStep("select")
  }, [address])

  const handleTokenSelection = (tokenAddress: string, selected: boolean) => {
    // 防止选择原生代币（地址为 0x0000000000000000000000000000000000000000）
    if (tokenAddress === "0x0000000000000000000000000000000000000000") {
      return
    }
    
    if (selected) {
      setSelectedTokens((prev) => [...prev, tokenAddress])
    } else {
      setSelectedTokens((prev) => prev.filter((addr) => addr !== tokenAddress))
    }
  }

  const handleSelectAll = () => {
    const selectableTokens = tokens.filter((token) => !token.native_token && !token.is_spam)
    setSelectedTokens(selectableTokens.map((token) => token.contract_address))
  }

  const handleDeselectAll = () => {
    setSelectedTokens([])
  }

  const handlePrepareSwap = () => {
    if (selectedTokens.length > 0 && outcomeToken) {
      setSwapStep("configure")
    }
  }

  const handleExecuteSwap = async (txHash?: string, isAtomic?: boolean) => {
    if (txHash) {
      const totalValue = selectedTokens.reduce((sum, tokenAddr) => {
        const token = tokens.find((t) => t.contract_address === tokenAddr)
        return sum + (token?.quote || 0)
      }, 0)

      setSwapResult({
        tokensSwapped: selectedTokens.length,
        totalValue,
        outcomeToken: outcomeToken, // 使用简单标识符（"native", "usdc"）
        chain: getChainName(chainId as SupportedChainId),
        txHash: txHash as Hash,
        chainId: chainId as SupportedChainId,
        isAtomic: isAtomic ?? atomicSupported,
      })
      setSwapStep("success")
    }
  }

  const handleNewSweep = () => {
    setSelectedTokens([])
    setOutcomeToken("")
    setSwapResult(null)
    setSwapStep("select")
    refetch()
  }


  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center max-w-4xl mx-auto">
            <div className="mb-8">
              <div className="inline-flex items-center justify-center mb-6">
                <img
                  src="/DustSweeper-logo.png"
                  alt="Dust Sweeper"
                  className="h-12 sm:h-16 md:h-20"
                />
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4 sm:mb-6 px-4">
              Clean Up Your Wallet Dust
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-6 sm:mb-8 max-w-2xl mx-auto px-4">
              Swap multiple small token balances into one preferred token with a
              single transaction. Powered by EIP-7702 for the ultimate user
              experience.
            </p>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12 px-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                    <span className="truncate">Connect Wallet</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm sm:text-base text-gray-600">
                    Connect your wallet to view your token portfolio
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
                    <span className="truncate">Select Tokens</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm sm:text-base text-gray-600">
                    Choose which dust tokens you want to consolidate
                  </p>
                </CardContent>
              </Card>

              <Card className="sm:col-span-2 md:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 flex-shrink-0" />
                    <span className="truncate">One-Click Sweep</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm sm:text-base text-gray-600">
                    Execute all swaps in a single transaction
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="mt-12 mb-12">
              <EIP7702Info />
            </div>

            {/* Mobile environment detection card */}
            {isMobile && !isInMetaMask && (
              <div className="mb-6 max-w-2xl mx-auto">
                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-amber-900 mb-1">Mobile Browser Detected</h3>
                        <p className="text-sm text-amber-800">
                          For the best experience, please open this page in the MetaMask in-app browser.
                          Open MetaMask app and navigate to this page from within MetaMask.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="flex justify-center mb-8 sm:mb-12 px-4">
              <Button
                onClick={() => {
                  if (isMobile && !isInMetaMask) {
                    alert('Please open this page in the MetaMask in-app browser for the best experience.')
                  }
                  if (isConnected) {
                    disconnect()
                  } else {
                    connect({ connector: metaMask() })
                  }
                }}
                size="lg"
                className={`w-full sm:w-auto sm:px-8 bg-blue-600 hover:bg-blue-700 hover:text-green-500 text-sm sm:text-base ${isMobile && !isInMetaMask ? 'opacity-60' : ''}`}
              >
                {!isConnected && (
                  <img
                    src="/MetaMask-icon-fox.svg"
                    alt="MetaMask"
                    className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0"
                  />
                )}
                {isConnected && <Wallet className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />}
                <span className="truncate">{isConnected ? "Disconnect Wallet" : "Connect Wallet"}</span>
              </Button>
            </div>

          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (swapStep === "success" && swapResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="container mx-auto px-4 py-8 sm:py-16">
          <div className="max-w-2xl mx-auto text-center">
            <div className="mb-6 sm:mb-8">
              <CheckCircle2 className="w-12 h-12 sm:w-16 sm:h-16 text-green-600 mx-auto mb-3 sm:mb-4" />
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 px-4">Wallet Dust Cleared!</h1>
              <p className="text-base sm:text-lg text-gray-600 px-4">Your tokens have been successfully consolidated</p>
            </div>

            <div className="px-2 sm:px-0">
              <SocialCard result={swapResult} />
            </div>

            <div className="mt-6 sm:mt-8 flex gap-4 justify-center px-4">
              <Button onClick={handleNewSweep} size="lg" className="w-full sm:w-auto text-sm sm:text-base">
                <Sparkles className="w-4 h-4 mr-2 flex-shrink-0" />
                New Sweep
              </Button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {swapStep === "select" && (
          <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            <div className="lg:col-span-2 order-1 lg:order-1">
              <TokenPortfolio
                tokens={tokens}
                loading={loading}
                selectedTokens={selectedTokens}
                onTokenSelect={handleTokenSelection}
                onSelectAll={handleSelectAll}
                onDeselectAll={handleDeselectAll}
                apiStatus={apiStatus}
                error={tokenError}
                chainId={chainId as SupportedChainId}
              />
            </div>

            <div className="space-y-4 sm:space-y-6 order-2 lg:order-2">
              <Card>
                <CardHeader className="pb-3 sm:pb-6">
                  <CardTitle className="text-base sm:text-lg text-blue-800">Sweep Summary</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Selected {selectedTokens.length} tokens to sweep</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="text-xs sm:text-sm font-medium mb-2 block">Receive Token</label>
                      <div className="relative" ref={tokenDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsTokenDropdownOpen(!isTokenDropdownOpen)}
                          className="w-full p-2 sm:p-2.5 border rounded-md bg-white text-left flex items-center justify-between hover:bg-gray-50 text-sm sm:text-base"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {outcomeToken === "native" ? (
                              <>
                                <img 
                                  src={getNativeTokenLogo(chainId as SupportedChainId)} 
                                  alt={getNativeTokenSymbol(chainId as SupportedChainId)}
                                  className="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex-shrink-0"
                                />
                                <span className="truncate text-xs sm:text-sm">{getNativeTokenSymbol(chainId as SupportedChainId)} - {getChainName(chainId as SupportedChainId)}</span>
                              </>
                            ) : outcomeToken === "usdc" ? (
                              <>
                                <img 
                                  src="/usdc-logo.svg" 
                                  alt="USDC"
                                  className="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex-shrink-0"
                                />
                                <span className="truncate text-xs sm:text-sm">USDC - USD Coin</span>
                              </>
                            ) : outcomeToken === "usdt" ? (
                              <>
                                <img 
                                  src="/usdt1-logo.svg" 
                                  alt="USDT"
                                  className="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex-shrink-0"
                                />
                                <span className="truncate text-xs sm:text-sm">USDT - Tether USD</span>
                              </>
                            ) : (
                              <span className="text-gray-500 text-xs sm:text-sm">Select token...</span>
                            )}
                          </div>
                          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ml-2 ${isTokenDropdownOpen ? 'transform rotate-180' : ''}`} />
                        </button>
                        {isTokenDropdownOpen && (
                          <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg">
                            <button
                              type="button"
                              onClick={() => {
                                setOutcomeToken("native")
                                setIsTokenDropdownOpen(false)
                              }}
                              className="w-full p-2 text-left flex items-center gap-2 hover:bg-gray-50 first:rounded-t-md last:rounded-b-md text-sm"
                            >
                              <img 
                                src={getNativeTokenLogo(chainId as SupportedChainId)} 
                                alt={getNativeTokenSymbol(chainId as SupportedChainId)}
                                className="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex-shrink-0"
                              />
                              <span className="truncate text-xs sm:text-sm">{getNativeTokenSymbol(chainId as SupportedChainId)} - {getChainName(chainId as SupportedChainId)}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOutcomeToken("usdc")
                                setIsTokenDropdownOpen(false)
                              }}
                              className="w-full p-2 text-left flex items-center gap-2 hover:bg-gray-50 first:rounded-t-md last:rounded-b-md text-sm"
                            >
                              <img 
                                src="/usdc-logo.svg" 
                                alt="USDC"
                                className="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex-shrink-0"
                              />
                              <span className="truncate text-xs sm:text-sm">USDC - USD Coin</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOutcomeToken("usdt")
                                setIsTokenDropdownOpen(false)
                              }}
                              className="w-full p-2 text-left flex items-center gap-2 hover:bg-gray-50 first:rounded-t-md last:rounded-b-md text-sm"
                            >
                              <img 
                                src="/usdt1-logo.svg" 
                                alt="USDT"
                                className="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex-shrink-0"
                              />
                              <span className="truncate text-xs sm:text-sm">USDT - Tether USD</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator />

                    <div className="text-xs sm:text-sm text-gray-600 space-y-1.5 sm:space-y-2">
                      <div className="flex justify-between">
                        <span>Slippage:</span>
                        <span>{(APP_CONFIG.SLIPPAGE_TOLERANCE * 100).toFixed(1)}%</span>
                      </div>
                    </div>

                    <Button
                      onClick={handlePrepareSwap}
                      disabled={selectedTokens.length === 0 || !outcomeToken}
                      className="w-full text-sm sm:text-base"
                      size="lg"
                    >
                      Prepare Swap
                      <ArrowRight className="w-4 h-4 ml-2 flex-shrink-0" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {(swapStep === "configure" || swapStep === "execute") && (
          <SwapConfiguration
            selectedTokens={selectedTokens}
            tokens={tokens}
            outcomeToken={outcomeToken}
            onExecute={handleExecuteSwap}
            onBack={() => setSwapStep("select")}
            executing={swapStep === "execute"}
            atomicSupported={atomicSupported}
            chainId={chainId as SupportedChainId}
          />
        )}
      </main>

      <Footer />
    </div>
  )
}
