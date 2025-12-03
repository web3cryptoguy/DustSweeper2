"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ExternalLink, CheckCircle2 } from "lucide-react";
import { getTokenLogoUrl } from "@/lib/utils";
import type { Token, SupportedChainId } from "@/types";

interface TokenPortfolioProps {
  tokens: Token[];
  loading: boolean;
  selectedTokens: string[];
  onTokenSelect: (tokenAddress: string, selected: boolean) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  apiStatus?: string | null;
  error?: string | Error | null;
  chainId: SupportedChainId;
}

// 获取可选择代币的数量（排除原生代币和垃圾代币）
const getSelectableTokensCount = (tokens: Token[]): number => {
  return tokens.filter((token) => !token.native_token && !token.is_spam && token.quote > 0).length
}

const formatTokenAmount = (amount: string, decimals: number): string => {
  const num = Number(amount) / Math.pow(10, decimals);
  if (num === 0) return "0";
  if (num < 0.0001) return "<0.0001";
  return num.toFixed(6).replace(/\.?0+$/, "");
};

const formatUsdValue = (value: number): string => {
  if (value === 0) return "$0.00";
  if (value < 0.01) return "<$0.01";
  return `$${value.toFixed(2)}`;
};

const formatPrice = (value: number): string => {
  if (value === 0) return "$0.00";
  if (value < 0.000001) return "<$0.000001";
  return `$${value.toFixed(6)}`;
};

const truncateAddress = (address: string): string => {
  if (!address) return "";
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

// 截断代币名称，限制长度以避免布局问题
// 移动端使用12字符限制，确保不会导致显示问题
const truncateTokenName = (name: string, maxLength: number = 12): string => {
  if (!name) return "";
  if (name.length <= maxLength) return name;
  return `${name.slice(0, maxLength - 3)}...`;
};

const getBlockExplorerUrl = (address: string, chainId: SupportedChainId): string => {
  const baseUrls: Record<SupportedChainId, string> = {
    1: "https://etherscan.io/token",
    137: "https://polygonscan.com/token",
    56: "https://bscscan.com/token",
    42161: "https://arbiscan.io/token",
    8453: "https://basescan.org/token",
    10: "https://optimistic.etherscan.io/token",
    143: "https://monad.socialscan.io/token",
  };
  return `${baseUrls[chainId] || baseUrls[1]}/${address}`;
};

export default function TokenPortfolio({
  tokens,
  loading,
  selectedTokens,
  onTokenSelect,
  onSelectAll,
  onDeselectAll,
  apiStatus,
  error,
  chainId,
}: TokenPortfolioProps) {
  const totalValue = tokens.reduce((sum, token) => sum + (token.quote || 0), 0);
  const selectedCount = selectedTokens.length;
  const selectedValue = tokens
    .filter((t) => selectedTokens.includes(t.contract_address))
    .reduce((sum, token) => sum + (token.quote || 0), 0);
  
  // 计算可选择代币的数量（排除原生代币）
  const selectableTokens = tokens.filter((token) => !token.native_token && !token.is_spam && token.quote > 0);
  const selectableCount = selectableTokens.length;
  
  // 计算已选择的ERC20代币数量（排除原生代币）
  const selectedERC20Count = selectedTokens.filter((addr) => {
    const token = tokens.find(t => t.contract_address === addr);
    return token && !token.native_token;
  }).length;
  
  // 判断是否所有ERC20代币都被选中
  const allSelected = selectableCount > 0 && selectedERC20Count === selectableCount;
  
  // 切换全选/取消全选
  const handleToggleAll = () => {
    if (allSelected) {
      onDeselectAll();
    } else {
      onSelectAll();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading your token portfolio...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-red-600 mb-4">Failed to fetch token data</p>
          <p className="text-sm text-gray-600">{typeof error === 'string' ? error : error.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-visible">
      <CardHeader className="pb-3 sm:pb-6 px-3 sm:px-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <CardTitle className="text-base sm:text-lg text-blue-800">Your Token Portfolio</CardTitle>
            <Badge className="bg-green-500 text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded-full flex items-center gap-1 text-xs">
              <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span className="hidden sm:inline">Live Data</span>
              <span className="sm:hidden">Live</span>
            </Badge>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleToggleAll} 
            className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600 text-xs sm:text-sm w-full sm:w-auto"
          >
            {allSelected ? "Deselect All" : "Select All"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-3 sm:pt-6 px-3 sm:px-6">
        <div className="space-y-3 sm:space-y-4">
          {selectedCount > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 sm:p-3 flex items-center justify-between">
              <p className="text-xs sm:text-sm text-gray-700">
                <span className="text-sm sm:text-base font-semibold text-purple-600">{selectedCount}</span> tokens selected
              </p>
              <p className="text-sm sm:text-base font-semibold text-purple-600">
                {formatUsdValue(selectedValue)}
              </p>
            </div>
          )}

          <div className="space-y-2 max-h-[60vh] sm:max-h-96 overflow-y-auto overflow-x-visible">
            {tokens.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No tokens found in your wallet</p>
            ) : (
              <>
                {/* Separate native token and ERC20 tokens */}
                {(() => {
                  const nativeToken = tokens.find(t => t.native_token);
                  const erc20Tokens = tokens.filter(t => !t.native_token);
                  
                  const renderToken = (token: Token, isDisabled: boolean = false) => {
                    const tokenAmount = formatTokenAmount(token.balance, token.contract_decimals);
                    const tokenSymbol = token.contract_ticker_symbol || "Unknown";
                    const fullTokenName = token.contract_name || tokenSymbol;
                    // 移动端限制12字符，避免布局问题
                    const tokenName = truncateTokenName(fullTokenName, 12);
                    const rawBalance = Number(token.balance) / Math.pow(10, token.contract_decimals);
                    // Use usd_price if available, otherwise calculate from quote
                    const price = token.usd_price !== undefined 
                      ? token.usd_price 
                      : (token.quote > 0 && rawBalance > 0 
                          ? token.quote / rawBalance 
                          : 0);
                    const isNative = token.native_token;
                    const isSelected = selectedTokens.includes(token.contract_address);
                    
                    return (
                      <div
                        key={token.contract_address}
                        className={`flex items-start sm:items-center gap-1.5 sm:gap-3 p-2 sm:p-3 border rounded-lg transition-colors ${
                          isDisabled 
                            ? "bg-gray-50 border-gray-200 opacity-75"
                            : isSelected
                            ? "bg-blue-50 border-blue-300"
                            : "bg-white border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {!isNative && (
                          <Checkbox
                            checked={isSelected}
                            disabled={isDisabled}
                            onCheckedChange={(checked) => {
                              if (!isDisabled) {
                                onTokenSelect(token.contract_address, checked === true);
                              }
                            }}
                            className="flex-shrink-0 mt-1 sm:mt-0"
                          />
                        )}
                        {isNative && (
                          <div className="w-4 sm:w-5 flex-shrink-0" />
                        )}
                        <img
                          src={getTokenLogoUrl(token, chainId)}
                          alt={tokenName}
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 
                              className="font-semibold text-xs sm:text-sm truncate max-w-[150px] sm:max-w-none"
                              title={fullTokenName}
                            >
                              {tokenName}
                            </h3>
                          </div>
                          <div className="flex flex-col gap-0.5 sm:gap-1 text-xs text-gray-600 mb-1">
                            <span className="truncate">{tokenAmount} {tokenSymbol}</span>
                            {isNative ? (
                              <span className="text-gray-500 text-xs">Native Token</span>
                            ) : (
                              <a
                                href={getBlockExplorerUrl(token.contract_address, chainId)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-gray-500 hover:text-blue-600 flex items-center gap-1 text-xs"
                              >
                                <span className="truncate">{truncateAddress(token.contract_address)}</span>
                                <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 sm:gap-1 flex-shrink-0 min-w-[65px] sm:min-w-[100px]">
                          <div className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1 hidden sm:block">
                            Current Price
                          </div>
                          <div className="text-xs sm:text-sm text-gray-700 mb-1 sm:mb-2">
                            {formatPrice(price)}
                          </div>
                          <div className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">
                            Value
                          </div>
                          <div className="text-xs sm:text-sm font-semibold text-yellow-600">
                            {formatUsdValue(token.quote || 0)}
                          </div>
                        </div>
                      </div>
                    );
                  };
                  
                  return (
                    <>
                      {/* Native token - always first, disabled */}
                      {nativeToken && renderToken(nativeToken, true)}
                      
                      {/* ERC20 tokens */}
                      {erc20Tokens.map(token => renderToken(token, false))}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
