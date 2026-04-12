import type { Metadata } from "next";
import { DM_Sans, Oswald, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Teriak Planner — Planification de Production",
  description: "Système de planification de charge — Laboratoires Teriak",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="h-full">
      <body
        className={`${dmSans.variable} ${oswald.variable} ${jetbrainsMono.variable} h-full bg-gray-50 text-gray-900`}
        style={{ fontFamily: "var(--font-sans), Arial, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
