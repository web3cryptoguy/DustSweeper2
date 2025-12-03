"use client"

import { useEffect, useState } from "react"
import Navbar from "./navbar"
import { validateEnvironment, logEnvironmentStatus } from "@/lib/env-validation"
import { useAccount } from "wagmi"

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [envStatus, setEnvStatus] = useState<ReturnType<typeof validateEnvironment> | null>(null)
  const { isConnected } = useAccount()

  // 验证环境配置
  useEffect(() => {
    const result = logEnvironmentStatus()
    setEnvStatus(result)
  }, [])

  // 首页（未连接钱包）不显示导航栏
  return (
    <div className="w-full min-h-screen flex flex-col">
      {isConnected && <Navbar envStatus={envStatus} />}
      <div className={`flex-1 w-full ${isConnected ? "pt-16 sm:pt-20" : ""}`}>
        {children}
      </div>
    </div>
  )
}

