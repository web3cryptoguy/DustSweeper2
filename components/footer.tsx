"use client"

import { Heart, ExternalLink } from "lucide-react"
import Image from "next/image"

export default function Footer() {
  return (
    <footer className="sticky top-[100vh] bg-white border-t">
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-2 text-xs sm:text-sm text-gray-600">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span>Built with</span>
            <Heart className="w-3 h-3 sm:w-4 sm:h-4 text-red-500 fill-current" />
            <span>by</span>
            <a
              href="https://www.quicknode.com/sample-app-library/token-sweeper-eip-7702"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-blue-600 hover:text-green-600 transition-colors flex items-center gap-1"
            >
              QuickNode
              <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </a>
            <a
              href="https://github.com/quiknode-labs/qn-guide-examples/tree/main/sample-dapps/token-sweeper-eip-7702"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 sm:ml-4 hover:opacity-80 transition-opacity"
              title="View on GitHub"
            >
              <Image
                src="/github.svg"
                alt="GitHub"
                width={20}
                height={20}
                className="w-6 h-6 sm:w-7 sm:h-7 md:w-5 md:h-5"
              />
            </a>
          </div>
          <span className="hidden sm:inline text-xs text-gray-400 sm:ml-4 text-center max-w-2xl">
            Token Sweeper is a decentralized application. Always verify transactions before signing. Not financial advice.
          </span>
        </div>
        <div className="mt-2 sm:hidden">
          <span className="text-[10px] text-gray-400 text-center block px-4">
            Token Sweeper is a decentralized application. Always verify transactions before signing. Not financial advice.
          </span>
        </div>
      </div>
    </footer>
  )
}
