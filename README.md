# Token Sweeper 🧹

Token Sweeper 是一个 DeFi 应用程序，使用户能够通过 EIP-7702 批量交易高效地将多个小额 ERC-20 代币余额**清扫**到单个首选代币中。在 Base 和 Optimism 主网上体验单次签名的原子交换。

## 🚀 核心功能

### 主要功能
- **🔄 多代币整合**: 通过最优路由将多个零散代币转换为单个首选代币
- **⚡ EIP-7702 批量交易**: 在单次交易签名中原子性地执行所有交换
- **📊 实时投资组合追踪**: 通过 Moralis API 实时获取代币余额
- **🛡️ 高级垃圾代币过滤**: 通过 Moralis API 和 Aerodrome/Velodrome Swap API 检测垃圾/诈骗代币
- **🌐 多链支持**: 完整支持 Base (8453) 和 Optimism (10)，集成原生 DEX（Aerodrome 和 Velodrome）
- **📱 社交成就卡片**: 生成并分享精美的交换后成就卡片

<img src="public/review-your-swap.png" alt="Review Your Swap" width="50%" />

## 📊 技术架构

### 应用工作流程图
<img src="public/application-workflow-diagram.png" alt="应用工作流" width="30%" />

### 应用序列图

<img src="public/application-sequence-diagram.png" alt="应用序列图" width="30%" />


### 📁 项目结构

```
token-sweeper/
├── app/                          # Next.js App Router
│   ├── api/                      # API 路由
│   │   ├── moralis/              # Moralis API 集成
│   │   ├── swap/                 # 交换 API 集成
│   │   └── tokens/               # 代币 API 集成
│   ├── layout.tsx               # 带提供者的根布局
│   ├── page.tsx                 # 主应用程序组件
│   └── globals.css              # 全局样式
├── components/                   # React 组件
│   ├── ui/                      # shadcn/ui 组件
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   └── ...
│   ├── eip-7702-info.tsx       # EIP-7702 信息显示
│   ├── footer.tsx              # 应用页脚
│   └── providers.tsx           # 上下文提供者
│   ├── social-card.tsx         # 可分享的成就卡片
│   ├── swap-configuration.tsx   # 交换报价和执行
│   ├── token-portfolio.tsx      # 代币选择界面
│   ├── wallet-connection.tsx    # 钱包连接界面
├── hooks/                       # 自定义 React hooks
│   ├── use-outcome-tokens.ts   # DEX 代币获取
│   ├── use-swap-builder.ts     # 交易构建
│   ├── use-swap-quotes.ts      # 交换报价获取
│   ├── use-token-balances.ts   # Moralis API 集成
│   ├── use-verified-tokens.ts  # 代币验证（缓存）
├── lib/                        # 工具函数
│   ├── config.ts              # 应用程序配置
│   ├── env-validation.ts      # 环境变量验证
│   ├── logger.ts              # 结构化日志
│   ├── token-config.ts        # 代币配置
│   └── utils.ts               # 通用工具
├── types/                      # 类型定义
│   ├── index.ts               # 主要类型导出
├── package.json               # 依赖和脚本
├── bunfig.toml               # Bun 配置文件
├── tailwind.config.ts         # Tailwind CSS 配置
├── next.config.mjs           # Next.js 配置
└── tsconfig.json             # TypeScript 配置
```

## 🛠️ 技术栈

### 前端框架
- **Next.js 15**: 使用 App Router 的 React 框架
- **TypeScript**: 类型安全的开发
- **Tailwind CSS**: 实用优先的 CSS 框架
- **shadcn/ui**: 现代 React 组件库
- **Bun**: 高性能 JavaScript 运行时 (可选，推荐)

### Web3 集成
- **Wagmi**: 以太坊的 React Hooks
- **Viem**: 以太坊的 TypeScript 接口
- **RainbowKit**: 钱包连接
- **EIP-7702**: 原子批量交易支持

### API 和数据源
- **[Moralis API](https://moralis.io/)**: 代币余额获取和价格数据
- **[Aerodrome Swap API](https://marketplace.quicknode.com/add-on/aerodrome-swap-api)**: Base 链上领先 DEX Aerodrome 的报价和交换
- **[Velodrome Swap API](https://marketplace.quicknode.com/add-on/velodrome-swap-api)**: Optimism 链上领先 DEX Velodrome 的报价和交换

### 状态管理
- **React Hooks**: 组件级状态
- **TanStack Query**: 服务器状态管理
- **本地缓存**: API 响应缓存（5 分钟 TTL）

## 🚦 快速开始

### 前置要求

要运行和使用此应用程序，您需要以下内容：

- **Node.js 20+** 或 **Bun 1.0+** (推荐使用 Bun 以获得更好的性能)
- 一个带有 API 密钥的 [Moralis](https://moralis.io/) 账户
- 一个带有 Base 或 Optimism 端点的 [QuickNode](http://dashboard.quicknode.com/) 账户 (可选，用于 Swap API)
- [Aerodrome](https://marketplace.quicknode.com/add-on/aerodrome-swap-api) 或 [Velodrome Swap API](https://marketplace.quicknode.com/add-on/velodrome-swap-api) 插件 (_提供免费套餐_)
- 安装 [MetaMask](https://metamask.io/) 浏览器扩展，支持 EIP-7702

#### 设置 Moralis

1. **创建 Moralis 账户**: 在 [Moralis](https://moralis.io/) 注册一个免费账户

2. **获取 API 密钥**: 
   - 访问您的 [Moralis 仪表板](https://admin.moralis.io/)
   - 进入 **Web3 APIs** 部分
   - 复制您的 **API 密钥**
   - 您可以选择设置备用 API 密钥以提高可靠性

3. **支持的链**: Moralis 开箱即用支持 Base (8453) 和 Optimism (10)

#### 设置 QuickNode (可选，用于 Swap API)

1. **创建端点**: 登录您的 [QuickNode 账户](http://dashboard.quicknode.com/)，为您要支持的每条链创建新端点。在本指南中，我们将使用 Base 和 Optimism。

> 由于这些 API 插件仅在主网上可用，您需要使用主网端点设置您的 QuickNode 账户。

2. **安装插件**:

- 进入端点仪表板后，导航到端点的 **插件** 部分。
- 安装 [Aerodrome Swap API](https://marketplace.quicknode.com/add-on/aerodrome-swap-api) 和 [Velodrome Swap API](https://marketplace.quicknode.com/add-on/velodrome-swap-api) 插件。您可以使用免费套餐开始使用交换 API。

3. **获取 Swap API URL**: 点击 Aerodrome 或 Velodrome Swap API 插件旁边的 **Getting Started**。这将显示您需要在应用程序中使用的基础 API URL。使用 `/v1/...` 之前的部分，因为我们将在代码中附加特定端点。它应该类似于：`https://YOUR-QUICKNODE-ENDPOINT-URL/addon/YOUR-ADDON-ID`

#### 安装 MetaMask

1. **安装 MetaMask 扩展**: 访问 [MetaMask 官网](https://metamask.io/) 并安装浏览器扩展
2. **创建或导入钱包**: 按照 MetaMask 的指引设置您的钱包
3. **确保支持 EIP-7702**: 确保您的 MetaMask 版本支持 EIP-7702 功能（最新版本通常已支持）

### 安装依赖

1. **克隆仓库**

```bash
git clone https://github.com/quiknode-labs/qn-guide-examples.git
cd qn-guide-examples/sample-dapps/token-sweeper-eip-7702
```

2. **安装依赖**

使用 npm:
```bash
npm install
```

使用 yarn:
```bash
yarn install
```

使用 pnpm:
```bash
pnpm install
```

使用 Bun (推荐):
```bash
bun install
# 或使用项目脚本
npm run install:bun
```

3. **设置环境变量**
```bash
cp .env.example .env.local
```

必需的环境变量:
```bash
# Moralis API 配置
MORALIS_PRIMARY_API_KEY=your-moralis-primary-api-key
MORALIS_FALLBACK_API_KEY=your-moralis-fallback-api-key  # 可选，用于备用
MORALIS_BASE_URL=https://deep-index.moralis.io/api/v2.2  # 可选，默认值

# INFURA 配置(可选，如果使用自定义 RPC)
NEXT_PUBLIC_INFURA_API_KEY==your-base-rpc-url

```

4. **启动开发服务器**

使用 npm:
```bash
npm run dev
```

使用 yarn:
```bash
yarn dev
```

使用 pnpm:
```bash
pnpm dev
```

使用 Bun (注意：Next.js 15 与 Bun 存在兼容性问题，推荐使用 Node.js):
```bash
# 如果遇到 api.createContextKey 错误，请使用 Node.js 运行
npm run dev
# 或
npm run dev:node
```

**重要提示**：由于 Next.js 15 使用了 Node.js 特定的 API（如 `async_hooks`），Bun 可能不完全支持。如果使用 Bun 遇到 `api.createContextKey is not a function` 错误，请使用 Node.js 运行开发服务器：
```bash
npm run dev
```

5. **访问应用程序**
```
http://localhost:3000
```

## 使用应用程序

1. **连接钱包**: 点击"连接 MetaMask"按钮，在 MetaMask 弹出窗口中确认连接。
2. **查看代币投资组合**: 应用程序将获取并显示您的 ERC-20 代币余额。
3. **选择要清扫的代币**: 选择您要整合的代币和首选输出代币。
4. **查看交换报价**: 应用程序将计算并显示您所选代币的最佳交换报价。
5. **执行交换**: 确认交易以将您的代币清扫到首选代币中。如果您有智能账户，它将作为单个批量交易执行；否则，它将按顺序处理。
6. **分享您的成就**: 交换后，您可以生成社交成就卡片，在社交媒体上分享您的成功。

## 🌐 支持的网络

| 网络 | 链 ID | DEX 集成 | 状态 |
|---------|----------|-----------------|---------|
| Base 主网 | 8453 | Aerodrome | ✅ 活跃 |
| Optimism 主网 | 10 | Velodrome | ✅ 活跃 |