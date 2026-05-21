import { NextRequest, NextResponse } from "next/server";
import { fetchWalletStats, deriveTags, type WalletStats } from "@/lib/etherscan";

export const runtime = "edge";

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

// 简单内存级限流:同 IP 10 秒内一次,避免恶意脚本刷 token
// (Edge 实例可能多份,这只是粗略保护;真要做严格限流应该用 Vercel KV / Upstash)
const recentCalls = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 10_000;

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const last = recentCalls.get(ip);
  if (last && now - last < RATE_LIMIT_WINDOW_MS) return false;
  recentCalls.set(ip, now);
  // 清理一下老条目
  if (recentCalls.size > 1000) {
    for (const [k, v] of recentCalls) {
      if (now - v > RATE_LIMIT_WINDOW_MS) recentCalls.delete(k);
    }
  }
  return true;
}

function buildPrompt(stats: WalletStats, tags: string[]): string {
  const firstDate = stats.firstTxTimestamp
    ? new Date(stats.firstTxTimestamp * 1000).toISOString().slice(0, 10)
    : "尚未激活";
  const lastDate = stats.lastTxTimestamp
    ? new Date(stats.lastTxTimestamp * 1000).toISOString().slice(0, 10)
    : "—";

  const topContractText = stats.topContracts.length
    ? stats.topContracts
        .map(
          (c, i) =>
            `${i + 1}. ${c.label ?? c.address.slice(0, 10) + "…"} (交互 ${c.count} 次)`,
        )
        .join("\n")
    : "暂无合约交互记录";

  return `你是一位资深 Web3 链上分析师,正在为 imToken 钱包十周年活动给一位用户写"链上人格画像"。

用户钱包数据:
- 地址: ${stats.address}
- 首笔交易日期: ${firstDate}
- 最近一笔交易日期: ${lastDate}
- 链上年龄: ${stats.ageInDays} 天 (约 ${(stats.ageInDays / 365).toFixed(1)} 年)
- 总交易数: ${stats.totalTxCount} 笔 (发出 ${stats.outgoingTxCount} / 收到 ${stats.incomingTxCount} / 失败 ${stats.failedTxCount})
- 累计转出 ETH: ${stats.totalEthVolumeOut.toFixed(4)} ETH
- 当前 ETH 余额: ${stats.balanceEth.toFixed(4)} ETH
- 独立交互合约数: ${stats.uniqueContractsInteracted}
- Top 5 高频合约:
${topContractText}
- 派生标签: ${tags.join(", ") || "无"}

请输出严格的 JSON,字段如下,不要任何额外说明或 Markdown 包裹:
{
  "title": "5-10 字的中文称号,有反差感、有梗(例:DeFi 修罗、链上摸鱼王、空投老猎人)",
  "subtitle": "一行 15-25 字的副标题,概括这个人的链上画风",
  "story": "120-180 字的中文画像故事,第二人称'你',基于上面真实数据展开,要有具体年份和数字,语气克制但带一点惊喜感,不要堆形容词,不要用 emoji",
  "highlights": ["三条 12-20 字的中文亮点短句,每条都基于一个具体数据点"]
}

注意:
- 如果链上年龄为 0 或交易数为 0,title 写"链上新生",story 写一段邀请他/她迈出第一步的话
- 数字要四舍五入到容易读的位数,不要堆小数点
- "story" 字段必须是单一段落,不要换行符
- 只输出 JSON,JSON 之外一个字符都不能有`;
}

interface PortraitJson {
  title: string;
  subtitle: string;
  story: string;
  highlights: string[];
}

function safeParse(text: string): PortraitJson | null {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    const obj = JSON.parse(cleaned);
    if (
      typeof obj.title === "string" &&
      typeof obj.subtitle === "string" &&
      typeof obj.story === "string" &&
      Array.isArray(obj.highlights)
    ) {
      return obj;
    }
  } catch {
    /* fall through */
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { address } = await req.json().catch(() => ({ address: "" }));

  if (typeof address !== "string" || !ADDR_RE.test(address)) {
    return NextResponse.json(
      { error: "请输入合法的 0x 开头 40 位以太坊地址" },
      { status: 400 },
    );
  }

  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "请求太快了,稍等 10 秒再试 🐢" },
      { status: 429 },
    );
  }

  const etherscanKey = process.env.ETHERSCAN_API_KEY;
  // 注意:不能用 ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL,因为这些会被 Claude Code 等
  // 工具的全局环境变量覆盖(它会劫持到本地代理)。用 MIMO_* 专用变量名。
  const anthropicKey = process.env.MIMO_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  const anthropicBaseUrl = process.env.MIMO_BASE_URL ?? process.env.ANTHROPIC_BASE_URL;
  const llmModel = process.env.LLM_MODEL ?? "mimo-v2.5-pro";

  if (!etherscanKey || !anthropicKey) {
    return NextResponse.json(
      { error: "服务端缺少 API key 配置(ETHERSCAN_API_KEY / ANTHROPIC_API_KEY)" },
      { status: 500 },
    );
  }

  let stats: WalletStats;
  try {
    stats = await fetchWalletStats(address, etherscanKey);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "获取链上数据失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const tags = deriveTags(stats);

  // 直接走 fetch 调 Anthropic 兼容端点,绕过 SDK 限制以便传 thinking.disabled
  // (MiMo Pro 系列默认开启 thinking,不关掉会把 max_tokens 吃光)
  const baseUrl = (anthropicBaseUrl ?? "https://api.anthropic.com").replace(/\/+$/, "");
  let portrait: PortraitJson | null = null;
  try {
    const requestUrl = `${baseUrl}/v1/messages`;
    const requestBody = {
      model: llmModel,
      max_tokens: 1500,
      thinking: { type: "disabled" },
      messages: [{ role: "user", content: buildPrompt(stats, tags) }],
    };
    console.log("[portrait] -> POST", requestUrl, "model=", llmModel);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 22000);
    let r: Response;
    try {
      r = await fetch(requestUrl, {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!r.ok) {
      const errBody = await r.text();
      throw new Error(`${r.status} ${errBody.slice(0, 300)}`);
    }
    const data = (await r.json()) as {
      content?: Array<{ type: string; text?: string }>;
      stop_reason?: string;
    };
    const text = (data.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("");
    if (!text) {
      throw new Error(
        `LLM 没有返回 text 内容(stop_reason=${data.stop_reason ?? "?"}).可能 thinking 模式没关闭,或模型不支持`,
      );
    }
    portrait = safeParse(text);
  } catch (e: unknown) {
    console.error("[portrait] LLM call failed:", e);
    const msg = e instanceof Error ? e.message : "调用 LLM 失败";
    return NextResponse.json(
      { error: msg, hint: "LLM 调用失败,请检查 ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL / LLM_MODEL 是否匹配" },
      { status: 502 },
    );
  }

  if (!portrait) {
    portrait = {
      title: stats.totalTxCount > 0 ? "神秘的链上行者" : "链上新生",
      subtitle:
        stats.totalTxCount > 0
          ? `链上 ${(stats.ageInDays / 365).toFixed(1)} 年,${stats.totalTxCount} 笔交易`
          : "这条链,正在等你的第一笔交易",
      story:
        stats.totalTxCount > 0
          ? `你在过去 ${stats.ageInDays} 天里完成了 ${stats.totalTxCount} 笔链上操作,与 ${stats.uniqueContractsInteracted} 个合约打过交道。每一笔都是你和这条链共同的记忆。`
          : "你的钱包还没有留下足迹。在 imToken 十周年的今天,愿你迈出链上的第一步。",
      highlights: tags.length ? tags.slice(0, 3) : ["待解锁", "待解锁", "待解锁"],
    };
  }

  return NextResponse.json({ stats, tags, portrait });
}
