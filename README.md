# 链上画像生成器 · imToken 十周年 AI 共创

一个最小可用的单页站点:输入以太坊钱包地址,后端读 Etherscan 数据后调 Claude Haiku 生成"链上人格画像",前端渲染成深色 Web3 极客风的卡片,可一键下载 PNG 或转推。

**献礼 imToken 十周年 AI 共创活动 ·** [10th.token.im](https://10th.token.im)

---

## 本地运行

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量(复制 .env.example → .env.local,填入下面两个 key)
#    - ANTHROPIC_API_KEY :https://console.anthropic.com/
#    - ETHERSCAN_API_KEY :https://etherscan.io/apis (免费,5 分钟注册)

# 3. 启动 dev server
npm run dev
# 打开 http://localhost:3000
```

## 部署到 Vercel (推荐)

1. 把这个目录推到 GitHub
2. Vercel 导入仓库,框架自动识别为 Next.js
3. 在 Vercel 项目的 `Settings → Environment Variables` 里添加:
   - `ANTHROPIC_API_KEY`
   - `ETHERSCAN_API_KEY`
4. Deploy,完事

> API key 走 Vercel Edge Function 中转,**前端不暴露**。

## 技术栈

- **Next.js 14**(App Router + Edge Runtime)
- **Etherscan API V2**(以太坊主网交易历史 + 余额)
- **Claude Haiku 4.5**(画像文案生成,单次成本 ~$0.001)
- **Tailwind CSS** 深色极客风 UI
- **html-to-image** 一键导出 PNG

## 目录结构

```
app/
  ├─ page.tsx              # 主页(输入框 + 卡片渲染 + 下载/分享)
  ├─ layout.tsx
  ├─ globals.css           # 霓虹背景 + 渐变描边
  └─ api/portrait/route.ts # Edge Function:数据 + LLM 中转
components/
  └─ PortraitCard.tsx      # 画像卡片(用 ref 暴露给 html-to-image)
lib/
  └─ etherscan.ts          # 链上数据获取 + 已知合约标签 + 派生标签
```

## 数据维度

每次生成会读取一个地址的:

- 链上年龄(首笔交易起算)
- 总 / 收 / 发 / 失败交易数
- 累计转出 ETH 量 + 当前 ETH 余额
- 独立交互合约数
- Top 5 高频合约(自动识别 Uniswap / Aave / Lido / OpenSea 等)
- 派生标签:`DeFi 借贷玩家` / `ETH 质押者` / `NFT 收藏家` / `Gas 战士` 等

数据塞给 Claude,要求返回严格 JSON:

```json
{
  "title": "5-10 字称号",
  "subtitle": "15-25 字副标题",
  "story": "120-180 字第二人称画像故事",
  "highlights": ["3 条 12-20 字亮点"]
}
```

## 已知限制

- 仅支持以太坊主网交易(Etherscan V2 同接口可平滑扩展到 L2,本版没接)
- 内部 token 转账、NFT 详细持仓没拉(后续可加 `tokennfttx`、`tokentx` 端点)
- LLM 文案有概率把 JSON 写崩,有 fallback 兜底文案

## License

仅供 imToken 十周年活动展示用,代码可自由参考。
