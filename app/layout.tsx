import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "链上画像 · imToken 十周年共创",
  description:
    "输入你的钱包地址,AI 为你生成专属链上人格画像。献礼 imToken 十周年。",
  openGraph: {
    title: "链上画像 · imToken 十周年共创",
    description: "输入你的钱包地址,AI 为你生成专属链上人格画像。",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="font-mono antialiased">{children}</body>
    </html>
  );
}
