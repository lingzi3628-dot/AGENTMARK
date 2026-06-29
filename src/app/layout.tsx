import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { StudioToaster } from "@/components/studio/studio-toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Giselle Studio — Visual AI Agent Builder",
  description:
    "An open-source-inspired AI agent studio for designing and running agentic workflows. Drag, connect, and compose multi-model agents visually.",
  keywords: [
    "Giselle", "AI agent", "agentic workflows", "visual builder",
    "LLM", "multi-model", "Next.js",
  ],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <StudioToaster />
      </body>
    </html>
  );
}
