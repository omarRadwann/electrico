import type { MetadataRoute } from "next";

// TODO(<<DOMAIN>>): set NEXT_PUBLIC_SITE_URL at deploy. The .example fallback is a
// flagged placeholder — the real domain is owner-held and must not be invented.
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://electrico.example";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
