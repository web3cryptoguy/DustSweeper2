"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Wallet, Loader2 } from "lucide-react"
import { useConnect, useAccount } from "wagmi"
import { metaMask } from "wagmi/connectors"

// 检测是否为移动设备
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

// 检测是否在 MetaMask 应用内浏览器
function isInMetaMaskBrowser(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window.ethereum?.isMetaMask && window.ethereum?.isMetaMask)
}

export default function WalletConnection() {
  const { connect, error: connectError } = useConnect()
  const { isConnected } = useAccount()
  const [connecting, setConnecting] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isInMetaMask, setIsInMetaMask] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 检测设备类型
  useEffect(() => {
    setIsMobile(isMobileDevice())
    setIsInMetaMask(isInMetaMaskBrowser())
  }, [])

  // 监听连接状态变化
  useEffect(() => {
    if (isConnected) {
      setConnecting(false)
      setError(null)
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current)
        connectionTimeoutRef.current = null
      }
    }
  }, [isConnected])

  // 监听连接错误
  useEffect(() => {
    if (connectError && connecting && !isConnected) {
      setError(
        `Connection failed: ${connectError.message}. If not connected after returning from MetaMask, please try again.`
      )
      setConnecting(false)
    }
  }, [connectError, connecting, isConnected])

  // 监听页面可见性变化，当页面重新获得焦点时检查连接状态
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isConnected && connecting) {
        setTimeout(() => {
          if (window.ethereum?.selectedAddress) {
            if (!isConnected) {
              try {
                connect({ connector: metaMask() })
              } catch (error) {
                console.error('Reconnection error:', error)
                setConnecting(false)
              }
            } else {
              setConnecting(false)
            }
          } else {
            setConnecting(false)
          }
        }, 1500)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
    }
  }, [isConnected, connecting, connect])

  // 处理钱包连接
  const handleConnectWallet = async () => {
    try {
      setConnecting(true)
      setError(null)
      
      // 移动端特殊处理
      if (isMobile && !isInMetaMask) {
        setError('Please open this page in MetaMask app browser first')
        setConnecting(false)
        return
      }
      
      connect({ connector: metaMask() })
      
      // 清除之前的超时
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current)
      }
      
      // 设置超时，如果连接失败
      connectionTimeoutRef.current = setTimeout(() => {
        if (!isConnected) {
          setConnecting(false)
          if (isMobile && window.ethereum?.selectedAddress) {
            setError('Wallet address detected but connection incomplete. Please ensure you are in MetaMask in-app browser, then retry.')
          } else {
            setError('Connection timeout. If not connected after returning from MetaMask, please retry.')
          }
        }
      }, 15000)
    } catch (error: any) {
      console.error('Connection error:', error)
      setError(`Connection error: ${error?.message || 'Unknown error'}`)
      setConnecting(false)
    }
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Wallet className="w-5 h-5" />
          Connect Your Wallet
        </CardTitle>
        <CardDescription>Connect your wallet to start cleaning up your token dust</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 移动端提示 */}
        {isMobile && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            {!isInMetaMask ? (
              <>
                <p className="text-xs text-amber-800 font-semibold mb-2">
                  ⚠️ Detected you are not in MetaMask in-app browser
                </p>
                <p className="text-xs text-amber-700">
                  Mobile connection steps: 1) Open MetaMask app 2) Tap the "Browser" tab 3) Open this page 4) Then click connect wallet
                </p>
              </>
            ) : (
              <p className="text-xs text-amber-800">
                ✅ Detected you are in MetaMask in-app browser, safe to connect
              </p>
            )}
          </div>
        )}

        {/* 连接状态 */}
        {connecting && (
          <div className="flex items-center justify-center gap-2 text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Connecting...</span>
          </div>
        )}

        {/* 错误信息 */}
        {error && !isConnected && !connecting && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs text-red-700 break-words">{error}</p>
            <p className="text-xs text-red-600 mt-2">
              If not connected after returning, please click the button below to reconnect
            </p>
          </div>
        )}

        {/* 连接按钮 */}
        <Button
          onClick={handleConnectWallet}
          disabled={connecting || (isMobile && !isInMetaMask)}
          className="w-full"
          size="lg"
        >
          {connecting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Wallet className="w-4 h-4 mr-2" />
              Connect Wallet
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
