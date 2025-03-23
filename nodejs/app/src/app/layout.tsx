import "@rainbow-me/rainbowkit/styles.css";
import "reactflow/dist/style.css";
import "./globals.css";

import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Glider",
  description:
    "Browser unlocked: AI empowers your EOA to autonomously master any dApp.",
  openGraph: {
    title: "Glider",
    description:
      "Browser unlocked: AI empowers your EOA to autonomously master any dApp.",
    images: [
      {
        url: "https://2025-trifecta.vercel.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "Glider OGP image",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} antialiased`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
