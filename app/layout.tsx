import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import { Web3Provider } from "@/components/providers"
import LayoutWrapper from "@/components/layout-wrapper"

export const metadata: Metadata = {
  title: "Token Sweeper - Clean Up Your Wallet Dust",
  description: "Swap multiple small token balances into one preferred token with a single transaction",
  generator: "v0.dev",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className={GeistSans.className} suppressHydrationWarning>
        <Web3Provider>
          <LayoutWrapper>{children}</LayoutWrapper>
        </Web3Provider>
      </body>
    </html>
  )
}
