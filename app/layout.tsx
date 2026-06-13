import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { asset } from "@/src/lib/asset";
import { contact } from "@/src/lib/contact";

// Display + body face placeholder (a variable grotesk) until <<FONT>> is
// confirmed. next/font self-hosts these at build time; Geist is OFL-licensed.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// TODO(<<DOMAIN>>): set NEXT_PUBLIC_SITE_URL at deploy. The .example fallback is a
// flagged placeholder — the real domain is owner-held and must not be invented.
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://electrico.example";
// Canonical page URL including the GH Pages basePath (asset() carries it) — the
// same resolution metadataBase + asset("/") produces for canonical/OG below.
const SITE_URL = new URL(asset("/"), SITE).toString();

// Structured data — honest minimal (briefing §12): an Organization plus one
// Service per brand pillar. name / url / email / serviceType ONLY — no address,
// geo, ratings, or credentials until the owner supplies real ones (Owner-Input
// Manifest #3/#5/#6). Upgrade to LocalBusiness when those land.
const ORG_ID = `${SITE_URL}#organization`;
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": ORG_ID,
      name: "ELECTRICO",
      url: SITE_URL,
      email: contact.email,
    },
    {
      "@type": "Service",
      name: "Power & Lighting",
      serviceType: "Electrical power and lighting",
      url: SITE_URL,
      provider: { "@id": ORG_ID },
    },
    {
      "@type": "Service",
      name: "Structures & Build",
      serviceType: "Structural construction and build",
      url: SITE_URL,
      provider: { "@id": ORG_ID },
    },
    {
      "@type": "Service",
      name: "Smart Home Systems",
      serviceType: "Smart home systems and automation",
      url: SITE_URL,
      provider: { "@id": ORG_ID },
    },
  ],
};

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
  alternates: { canonical: asset("/") },
  openGraph: {
    // Descriptive, not the bare wordmark — link unfurls must say what we do.
    title: "ELECTRICO — Power, structure, and smart systems",
    description:
      "We light the city, raise its structures, make it think, and keep its current alive.",
    type: "website",
    siteName: "ELECTRICO",
    url: asset("/"),
    images: [{ url: asset("/og.png"), width: 1200, height: 630, alt: "ELECTRICO — power, structure, smart systems" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ELECTRICO — Power, structure, and smart systems",
    description:
      "We light the city, raise its structures, make it think, and keep its current alive.",
    images: [asset("/og.png")],
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
        <script
          type="application/ld+json"
          // `<` escaped so the JSON can never terminate the script element.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c"),
          }}
        />
        {/* Keyboard users skip the decorative 3D dive straight to the content. */}
        <a className="skip-link" href="#contact">
          Skip to contact
        </a>
        {children}
        <noscript>
          {/* No JS = no canvas overlay: restore the beat copy + natural section
              heights (mirrors the html.no-3d rules in globals.css, which the
              ExperienceBoundary applies on WebGL failure). */}
          <style>{`
            .content-section { min-height: 0; }
            .content-section--beat .eyebrow,
            .content-section--beat .narrative { opacity: 1; pointer-events: auto; }
          `}</style>
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
