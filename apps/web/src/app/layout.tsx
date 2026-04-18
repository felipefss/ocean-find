import { ScraperWakeUp } from "@/components/scraper-wake-up";
import { TRPCProvider } from "@/lib/trpc/provider";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ocean Find — Atlantic Canada Jobs",
  description: "Find jobs in Atlantic Canada's designated employers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <TRPCProvider>
          <ScraperWakeUp />
          {children}
        </TRPCProvider>
      </body>
    </html>
  );
}
