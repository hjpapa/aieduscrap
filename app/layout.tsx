import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "교육 뉴스 인사이트",
  description: "초등교사 관점의 오늘의 교육 뉴스 브리핑",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
