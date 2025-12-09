"use client";

import { useState, useEffect } from "react";
import type { Token, SupportedChainId } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Loader2,
  Shield,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { useSendCalls, useAccount, useWaitForCallsStatus } from "wagmi";
import { useTransferBuilder, type TransferCall } from "@/hooks/use-transfer-builder";
import { formatEther, parseEther, isAddress } from "viem";
import { formatTokenAmount } from "@/lib/utils";

interface TransferConfigurationProps {
  tokens: Token[];
  onExecute: (txHash?: string, isAtomic?: boolean) => void;
  onBack: () => void;
  executing: boolean;
  atomicSupported: boolean;
  chainId: SupportedChainId;
}

export default function TransferConfiguration({
  tokens,
  onExecute,
  onBack,
  executing,
  atomicSupported,
  chainId,
}: TransferConfigurationProps) {
  const { address } = useAccount();
  const [targetAddress, setTargetAddress] = useState("");
  const [addressError, setAddressError] = useState<string | null>(null);
  
  const {
    buildTransferCalls,
    loading: buildingCalls,
    error: buildError,
  } = useTransferBuilder();

  const {
    sendCalls,
    data: callsId,
    isPending: sendingCalls,
    error: sendCallsError,
  } = useSendCalls();

  const [transferCalls, setTransferCalls] = useState<TransferCall[]>([]);
  const [precheckResult, setPrecheckResult] = useState<{
    total: number;
    valid: number;
    failed: number;
  } | null>(null);

  // Monitor batch transaction status
  const callsIdString = typeof callsId === "string" ? callsId : callsId?.id;
  const {
    data: callsStatus,
    isLoading: isWaitingForCalls,
    isError: callsError,
  } = useWaitForCallsStatus({
    id: callsIdString,
  });

  // Validate target address
  const validateAddress = (addr: string) => {
    if (!addr.trim()) {
      setAddressError("请输入目标地址");
      return false;
    }
    if (!isAddress(addr)) {
      setAddressError("地址格式不正确");
      return false;
    }
    if (addr.toLowerCase() === address?.toLowerCase()) {
      setAddressError("目标地址不能是当前钱包地址");
      return false;
    }
    setAddressError(null);
    return true;
  };

  // Build transfer calls
  const handleBuildTransfers = async () => {
    if (!validateAddress(targetAddress)) {
      return;
    }

    try {
      const result = await buildTransferCalls(tokens, targetAddress, chainId);
      setTransferCalls(result.calls);
      setPrecheckResult(result.precheckResult || undefined);
    } catch (error) {
      console.error("Error building transfers:", error);
    }
  };

  // Execute transfers
  const handleExecuteTransfer = async () => {
    if (!address) {
      alert("Wallet not connected");
      return;
    }

    if (transferCalls.length === 0) {
      alert("Please build transfer transaction first");
      return;
    }

    // Prevent multiple executions
    if (buildingCalls || sendingCalls) {
      return;
    }

    try {
      // Convert TransferCall to wagmi calls format
      const calls = transferCalls.map((call) => ({
        to: call.to,
        value: call.value,
        ...(call.data && { data: call.data }),
      }));

      // Execute batch transaction
      sendCalls({ calls, experimental_fallback: true });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error("Error executing transfer:", error);
      alert(`Transfer execution failed: ${errorMessage}`);
    }
  };

  // Monitor batch transaction status
  useEffect(() => {
    if (callsStatus) {
      if (callsStatus?.status === "success") {
        let actualTxHash = callsIdString || "";
        
        if (callsStatus.receipts && callsStatus.receipts.length > 0) {
          actualTxHash = callsStatus.receipts[0].transactionHash;
        } else if (atomicSupported) {
        }
        
        onExecute(actualTxHash, atomicSupported);
      } else if (callsStatus?.status === "pending") {
        // Still pending
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
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
            <h2 className="text-2xl font-bold mb-2">执行转账</h2>
            <p className="text-gray-600 mb-6">
              {sendingCalls
                ? "请在钱包中确认批量交易..."
                : isWaitingForCalls
                ? "等待链上确认..."
                : "处理批量交易中..."}
            </p>

            {(sendCallsError || buildError || callsError) && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">
                  错误:{" "}
                  {sendCallsError?.message ||
                    buildError ||
                    (callsError ? "交易监控错误" : "")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalValue = tokens.reduce((sum, token) => sum + token.quote, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </Button>
        <h1 className="text-2xl font-bold">转账全部资产</h1>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>转账详情</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Target Address Input */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  目标地址
                </label>
                <Input
                  type="text"
                  placeholder="0x..."
                  value={targetAddress}
                  onChange={(e) => {
                    setTargetAddress(e.target.value);
                    setAddressError(null);
                  }}
                  className={addressError ? "border-red-500" : ""}
                />
                {addressError && (
                  <p className="text-sm text-red-600 mt-1">{addressError}</p>
                )}
                <Button
                  onClick={handleBuildTransfers}
                  disabled={buildingCalls || !targetAddress.trim()}
                  className="mt-2 w-full"
                >
                  {buildingCalls ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      构建中...
                    </>
                  ) : (
                    "构建转账交易"
                  )}
                </Button>
              </div>

              {/* Transfer List */}
              {precheckResult && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm">
                    <div>总交易数: {precheckResult.total}</div>
                    <div className="text-green-600">有效交易: {precheckResult.valid}</div>
                    {precheckResult.failed > 0 && (
                      <div className="text-red-600">失败交易: {precheckResult.failed}</div>
                    )}
                  </div>
                </div>
              )}

              {transferCalls.length > 0 && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {transferCalls.map((call, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium">{call.description}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          到: {call.to}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {buildError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{buildError}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator className="my-6" />
          
          <Button
            onClick={handleExecuteTransfer}
            disabled={transferCalls.length === 0 || buildingCalls || sendingCalls}
            className="w-full"
            size="lg"
          >
            {buildingCalls ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                构建中...
              </>
            ) : sendingCalls ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                发送中...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                {atomicSupported ? "执行批量转账" : "发送交易"}
              </>
            )}
          </Button>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>摘要</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">代币数量:</span>
                <span className="font-medium">{tokens.length}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">总价值:</span>
                <span className="font-medium">${totalValue.toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">转账数量:</span>
                <span className="font-medium">{transferCalls.length}</span>
              </div>

              <Separator />

              <div className="flex justify-between text-sm">
                <span className="text-gray-600">交易模式:</span>
                <span
                  className={
                    atomicSupported ? "text-green-600" : "text-yellow-600"
                  }
                >
                  {atomicSupported ? "✓ 原子批量" : "⚡ 独立交易"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                {atomicSupported ? "EIP-7702 优势" : "交易信息"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {atomicSupported ? (
                <>
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-green-500 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">单笔交易</div>
                      <div className="text-xs text-gray-600">
                        所有转账在一个原子交易中执行
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-yellow-500 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">多笔交易</div>
                      <div className="text-xs text-gray-600">
                        需要逐一确认每笔转账
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

