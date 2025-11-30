"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ChevronDown } from "lucide-react";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { metaMask } from "wagmi/connectors";
import { getChainName } from "@/lib/config";
import type { SupportedChainId } from "@/types";
import Image from "next/image";

// 获取链的logo URL
const getChainLogo = (chainId: number): string => {
  switch (chainId) {
    case 1: // Ethereum
      return '/ethereum-logo.svg';
    case 137: // Polygon
      return '/polygon-logo.svg';
    case 56: // BSC
      return '/bnb-logo.svg';
    case 42161: // Arbitrum
      return '/arbitrum-logo.svg';
    case 8453: // Base
      return '/base-logo.svg';
    case 10: // Optimism
      return '/optimism-logo.svg';
    default:
      return '/placeholder.svg';
  }
};

// 格式化钱包地址（截断显示）
const formatAddress = (address: string): string => {
  if (!address) return "";
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

interface NavbarProps {
  envStatus?: ReturnType<typeof import("@/lib/env-validation").validateEnvironment> | null;
}

export default function Navbar({ envStatus }: NavbarProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [showNetworkMenu, setShowNetworkMenu] = useState(false);
  const networkMenuRef = useRef<HTMLDivElement>(null);
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const walletMenuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (networkMenuRef.current && !networkMenuRef.current.contains(event.target as Node)) {
        setShowNetworkMenu(false);
      }
      if (walletMenuRef.current && !walletMenuRef.current.contains(event.target as Node)) {
        setShowWalletMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-orange-100 border-b border-orange-200">
      <div className="container mx-auto px-4 py-3 sm:py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/DustSweeper-logo.png"
              alt="DustSweeper"
              width={24}
              height={24}
              className="w-6 h-6"
            />
          </div>

          <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-end">
            {envStatus && !envStatus.isValid && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                Dev Mode
              </Badge>
            )}
            {isConnected && (
              <div className="relative order-2 sm:order-none" ref={networkMenuRef}>
                <Button
                  onClick={() => setShowNetworkMenu(!showNetworkMenu)}
                  variant="default"
                  size="sm"
                  className="flex items-center gap-2 bg-black text-white hover:bg-gray-800 text-sm"
                >
                  <img
                    src={getChainLogo(chainId)}
                    alt={getChainName(chainId as SupportedChainId)}
                    className="w-4 h-4 sm:w-5 sm:h-5 rounded-full"
                  />
                  <span className="hidden sm:inline">{getChainName(chainId as SupportedChainId)}</span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
                {showNetworkMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    <div className="p-1">
                      {[
                        { id: 1, name: "Ethereum" },
                        { id: 137, name: "Polygon" },
                        { id: 56, name: "BSC" },
                        { id: 42161, name: "Arbitrum" },
                        { id: 8453, name: "Base" },
                        { id: 10, name: "Optimism" },
                      ].map((chain) => (
                        <button
                          key={chain.id}
                          onClick={async () => {
                            try {
                              if (chainId !== chain.id) {
                                await switchChain({ chainId: chain.id as SupportedChainId });
                              }
                              setShowNetworkMenu(false);
                            } catch (error) {
                              console.error('切换网络失败:', error);
                              setShowNetworkMenu(false);
                            }
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-gray-100 transition-colors ${
                            chainId === chain.id ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-700"
                          }`}
                        >
                          <img
                            src={getChainLogo(chain.id)}
                            alt={chain.name}
                            className="w-5 h-5 rounded-full"
                          />
                          <span>{chain.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {isConnected ? (
              <div className="relative order-1 sm:order-none" ref={walletMenuRef}>
                <Button
                  onClick={() => setShowWalletMenu(!showWalletMenu)}
                  variant="default"
                  size="sm"
                  className="flex items-center gap-2 bg-black text-white hover:bg-gray-800"
                >
                  <img
                    src="/MetaMask-icon-fox.svg"
                    alt="MetaMask"
                    className="w-5 h-5"
                  />
                  <span className="font-mono text-sm max-w-[100px] sm:max-w-none truncate">{formatAddress(address || "")}</span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
                {showWalletMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    <div className="p-1">
                      <button
                        onClick={() => {
                          disconnect();
                          setShowWalletMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-gray-100 transition-colors text-gray-700"
                      >
                        <Image src="/quit.svg" alt="Disconnect" width={16} height={16} />
                        <span>Disconnect</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Button
                onClick={() => connect({ connector: metaMask() })}
                variant="default"
                size="sm"
                className="order-1 sm:order-none flex items-center gap-2 text-sm"
              >
                <img
                  src="/MetaMask-icon-fox.svg"
                  alt="MetaMask"
                  className="w-4 h-4 sm:w-5 sm:h-5"
                />
                <span className="hidden sm:inline">Connect Wallet</span>
                <span className="sm:hidden">Connect</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
