import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Display + body face placeholder (a variable grotesk) until <<FONT>> is
// confirmed. next/font self-hosts these at build time; Geist is OFL-licensed.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ELECTRICO — Power, structure, and smart systems",
  description:
    "ELECTRICO designs and maintains the systems that bring buildings to life: power and lighting, structural builds, in-wall wiring, and smart-home automation.",
  openGraph: {
    title: "ELECTRICO",
    description:
      "We light the city, raise its structures, make it think, and keep its current alive.",
    type: "website",
    siteName: "ELECTRICO",
  },
};

export const viewport: Viewport = {
  themeColor: "#05070d",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
