import type { MetadataRoute } from "next";
import { BASE_PATH } from "@/src/lib/asset";

// TODO(<<DOMAIN>>): NEXT_PUBLIC_SITE_URL at deploy; .example is a flagged placeholder.
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://electrico.example";

// Required by `output: export` — emit a static sitemap.xml at build time.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE}${BASE_PATH}/`, changeFrequency: "monthly", priority: 1 }];
}
