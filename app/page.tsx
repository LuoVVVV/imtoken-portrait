"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { PortraitCard, type Portrait } from "@/components/PortraitCard";
import type { WalletStats } from "@/lib/etherscan";

interface PortraitResp {
  stats: WalletStats;
  tags: string[];
  portrait: Portrait;
}

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

const DEMO_ADDRESSES = [
  { label: "Vitalik.eth", addr: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
  { label: "imToken 团队 (1)", addr: "0xfff9976782d46cc05630d1f6ebab18b2324d6b14" },
];

export default function Home() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PortraitResp | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  async function handleGenerate(addr?: string) {
    const target = (addr ?? input).trim();
    if (!ADDR_RE.test(target)) {
      setError("地址格式不对,要 0x 开头 + 40 位十六进制");
      return;
    }
    setError(null);
    setLoading(true);
    setData(null);
    try {
      const r = await fetch("/api/portrait", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: target }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "生成失败");
      setData(j);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#05060A",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `onchain-portrait-${data?.stats.address.slice(0, 8)}.png`;
      a.click();
    } catch (e) {
      console.error(e);
      setError("下载失败,请截图保存");
    }
  }

  return (
    <main className="min-h-screen bg-grid">
      <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        {/* 标题 */}
        <header className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-neon-purple/30 bg-neon-purple/5 px-3 py-1 text-xs text-neon-purple">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-neon-purple" />
            imToken × AI · 十周年共创
          </div>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            链上画像 <span className="text-glow-purple text-neon-purple">生成器</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-neutral-400">
            输入一个钱包地址,AI 会读完它的链上历史,
            给你写一份带专属称号、数据指标和小故事的画像卡。
            <br />
            自己的、Vitalik 的、神鱼的 —— 都可以。
          </p>
        </header>

        {/* 输入区 */}
        <section className="mt-10">
          <div className="card-ring relative rounded-xl bg-plate p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="0x… 输入以太坊地址"
                className="flex-1 rounded-lg border border-line bg-ink px-4 py-3 font-mono text-sm text-white outline-none placeholder:text-neutral-600 focus:border-neon-cyan/60"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleGenerate();
                }}
              />
              <button
                onClick={() => handleGenerate()}
                disabled={loading}
                className="rounded-lg bg-gradient-to-r from-neon-purple to-neon-cyan px-6 py-3 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-40"
              >
                {loading ? "AI 正在读你的链上人生…" : "生成画像"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
              <span>试试看:</span>
              {DEMO_ADDRESSES.map((d) => (
                <button
                  key={d.addr}
                  onClick={() => {
                    setInput(d.addr);
                    handleGenerate(d.addr);
                  }}
                  className="rounded-full border border-line bg-ink px-2.5 py-1 text-neutral-400 transition hover:border-neon-cyan/40 hover:text-neon-cyan"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-neon-pink/30 bg-neon-pink/5 px-4 py-3 text-sm text-neon-pink">
              {error}
            </div>
          )}
        </section>

        {/* 结果区 */}
        {loading && (
          <div className="mt-12 flex items-center justify-center gap-1 text-sm text-neutral-500">
            <span className="dot">●</span>
            <span className="dot">●</span>
            <span className="dot">●</span>
            <span className="ml-3">读取链上数据,并请 Claude 写画像中</span>
          </div>
        )}

        {data && !loading && (
          <section className="mt-12 flex flex-col items-center gap-5">
            <PortraitCard
              ref={cardRef}
              stats={data.stats}
              tags={data.tags}
              portrait={data.portrait}
            />
            <div className="flex gap-3">
              <button
                onClick={handleDownload}
                className="rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-4 py-2 text-sm text-neon-cyan transition hover:bg-neon-cyan/20"
              >
                ⬇ 下载 PNG
              </button>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                  `我用 AI 生成了自己的链上画像 ——「${data.portrait.title}」\n${data.portrait.subtitle}\n\n#imToken十周年 #AI共创`,
                )}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-line bg-plate px-4 py-2 text-sm text-neutral-300 transition hover:border-neon-cyan/40 hover:text-neon-cyan"
              >
                发推分享
              </a>
            </div>
          </section>
        )}

        <footer className="mt-20 border-t border-line pt-6 text-center text-xs text-neutral-600">
          <div>
            数据来源:Etherscan · 文案生成:Claude Haiku 4.5 · 仅供娱乐,不构成投资建议
          </div>
          <div className="mt-1">
            献礼{" "}
            <a
              className="text-neon-purple hover:underline"
              href="https://10th.token.im"
              target="_blank"
              rel="noreferrer"
            >
              imToken 十周年 AI 共创活动
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
