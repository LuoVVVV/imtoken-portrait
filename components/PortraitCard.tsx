"use client";

import { forwardRef } from "react";
import type { WalletStats } from "@/lib/etherscan";

export interface Portrait {
  title: string;
  subtitle: string;
  story: string;
  highlights: string[];
}

interface Props {
  stats: WalletStats;
  tags: string[];
  portrait: Portrait;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtDate(ts: number | null) {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function fmtNum(n: number, digits = 0) {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return n.toFixed(digits);
}

export const PortraitCard = forwardRef<HTMLDivElement, Props>(function PortraitCard(
  { stats, tags, portrait },
  ref,
) {
  return (
    <div
      ref={ref}
      className="card-ring relative w-[640px] max-w-full rounded-2xl bg-plate p-8 shadow-glow"
      style={{ fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" }}
    >
      {/* 顶部:品牌 + 地址 */}
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-neon-cyan shadow-[0_0_8px_#22E8FF]" />
          <span className="tracking-widest">ONCHAIN PORTRAIT</span>
        </div>
        <div className="tracking-wider">imToken × AI · 10Y</div>
      </div>

      {/* 称号 */}
      <div className="mt-6">
        <div className="text-xs text-neutral-500">TITLE</div>
        <h1 className="mt-1 text-4xl font-bold leading-tight text-white text-glow-purple">
          {portrait.title}
        </h1>
        <p className="mt-2 text-sm text-neon-cyan/90">{portrait.subtitle}</p>
      </div>

      {/* 数据网格 */}
      <div className="mt-6 grid grid-cols-3 gap-px rounded-lg bg-line/60 overflow-hidden">
        <DataCell label="链上年龄" value={`${(stats.ageInDays / 365).toFixed(1)} y`} hint={`自 ${fmtDate(stats.firstTxTimestamp)}`} />
        <DataCell label="总交易数" value={fmtNum(stats.totalTxCount)} hint={`成功 ${stats.totalTxCount - stats.failedTxCount}`} />
        <DataCell label="独立合约" value={fmtNum(stats.uniqueContractsInteracted)} hint="个" />
        <DataCell label="转出 ETH" value={fmtNum(stats.totalEthVolumeOut, 2)} hint="累计" />
        <DataCell label="ETH 余额" value={fmtNum(stats.balanceEth, 3)} hint="当前" />
        <DataCell label="最近活跃" value={fmtDate(stats.lastTxTimestamp)} hint="" />
      </div>

      {/* 标签 */}
      {tags.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full border border-neon-purple/40 bg-neon-purple/10 px-3 py-1 text-xs text-neon-purple"
            >
              # {t}
            </span>
          ))}
        </div>
      )}

      {/* 故事 */}
      <div className="mt-6">
        <div className="text-xs text-neutral-500">STORY</div>
        <p className="mt-2 text-[15px] leading-7 text-neutral-200">{portrait.story}</p>
      </div>

      {/* 亮点 */}
      {portrait.highlights?.length > 0 && (
        <div className="mt-5 space-y-1.5">
          {portrait.highlights.map((h, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-neutral-300">
              <span className="mt-1 inline-block h-1 w-3 bg-neon-cyan" />
              <span>{h}</span>
            </div>
          ))}
        </div>
      )}

      {/* Top 合约 */}
      {stats.topContracts.length > 0 && (
        <div className="mt-6">
          <div className="text-xs text-neutral-500">TOP CONTRACTS</div>
          <div className="mt-2 space-y-1">
            {stats.topContracts.slice(0, 3).map((c, i) => (
              <div key={c.address} className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">
                  <span className="text-neon-purple">{String(i + 1).padStart(2, "0")}</span>{" "}
                  {c.label ?? shortAddr(c.address)}
                </span>
                <span className="text-neutral-500">× {c.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 底部:地址 + slogan */}
      <div className="mt-7 flex items-end justify-between border-t border-line pt-4">
        <div>
          <div className="text-[10px] text-neutral-600">WALLET</div>
          <div className="font-mono text-xs text-neutral-400">{shortAddr(stats.address)}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-neutral-600">imToken 十周年 · AI 共创</div>
          <div className="text-xs text-neon-cyan">10th.token.im</div>
        </div>
      </div>
    </div>
  );
});

function DataCell({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-plate p-3">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
      {hint && <div className="text-[10px] text-neutral-600">{hint}</div>}
    </div>
  );
}
