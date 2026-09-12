import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "せどり利益計算ツール｜仕入れ上限価格を簡単計算",
  description:
    "販売価格・仕入れ価格・送料・販売手数料から、利益額・利益率・ROI・仕入れ上限価格を簡単に計算できる無料のせどり利益計算ツールです。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-slate-100 text-slate-900 overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
