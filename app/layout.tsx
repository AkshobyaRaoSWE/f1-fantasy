import type { Metadata } from "next";
import { Inter, Russo_One } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const russo = Russo_One({
  variable: "--font-russo",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "F1 Fantasy Lab",
  description:
    "Free F1 Fantasy optimizer, lineup builder, value board, and hindsight analysis. No login.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${russo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col bg-black text-white"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
