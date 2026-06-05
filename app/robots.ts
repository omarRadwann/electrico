import type { MetadataRoute } from "next";
import { BASE_PATH } from "@/src/lib/asset";

// TODO(<<DOMAIN>>): set NEXT_PUBLIC_SITE_URL at deploy. The .example fallback is a
// flagged placeholder — the real domain is owner-held and must not be invented.
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://electrico.example";

// Required by `output: export` — emit a static robots.txt at build time.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE}${BASE_PATH}/sitemap.xml`,
  };
}
