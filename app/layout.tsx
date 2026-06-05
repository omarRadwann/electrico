import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Display + body face placeholder (a variable grotesk) until <<FONT>> is
// confirmed. next/font self-hosts these at build time; Geist is OFL-licensed.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// TODO(<<DOMAIN>>): set NEXT_PUBLIC_SITE_URL at deploy. The .example fallback is a
// flagged placeholder — the real domain is owner-held and must not be invented.
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://electrico.example";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "ELECTRICO — Power, structure, and smart systems",
    template: "%s · ELECTRICO",
  },
  description:
    "ELECTRICO designs and maintains the systems that bring buildings to life: power and lighting, structural builds, in-wall wiring, and smart-home automation.",
  applicationName: "ELECTRICO",
  keywords: [
    "ELECTRICO",
    "power and lighting",
    "electrical contractor",
    "structural build",
    "steel frame",
    "smart home",
    "home automation",
    "wiring and maintenance",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "ELECTRICO",
    description:
      "We light the city, raise its structures, make it think, and keep its current alive.",
    type: "website",
    siteName: "ELECTRICO",
    url: "/",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "ELECTRICO — power, structure, smart systems" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ELECTRICO",
    description:
      "We light the city, raise its structures, make it think, and keep its current alive.",
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
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
      <body>
        {/* Keyboard users skip the decorative 3D dive straight to the content. */}
        <a className="skip-link" href="#contact">
          Skip to contact
        </a>
        {children}
        <noscript>
          <div className="noscript-fallback">
            <strong>ELECTRICO</strong> — power &amp; lighting, structural builds,
            in-wall wiring &amp; maintenance, and smart-home systems. This site features
            an interactive 3D experience; enable JavaScript to view it. The full company
            information remains readable below.
          </div>
        </noscript>
      </body>
    </html>
  );
}
