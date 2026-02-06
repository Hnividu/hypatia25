import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#EAB308",
};

export const metadata: Metadata = {
  title: "Hypatia Quiz Platform",
  description:
    "MCSS Science day quiz",
  keywords: [
    "quiz",
    "real-time",
    "education",
    "learning",
    "competitive",
    "kahoot alternative",
  ],
  authors: [{ name: "Quiz Platform" }],
  openGraph: {
    title: "Quiz Platform",
    description: "Real-time Competitive Quizzes",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
