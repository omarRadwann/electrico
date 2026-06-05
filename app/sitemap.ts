import type { MetadataRoute } from "next";

// TODO(<<DOMAIN>>): NEXT_PUBLIC_SITE_URL at deploy; .example is a flagged placeholder.
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://electrico.example";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE, changeFrequency: "monthly", priority: 1 }];
}
