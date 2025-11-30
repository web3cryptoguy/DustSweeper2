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
    <>
      {isConnected && <Navbar envStatus={envStatus} />}
      <div className={isConnected ? "pt-24 sm:pt-20" : ""}>
        {children}
      </div>
    </>
  )
}

