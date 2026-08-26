import type { MetadataRoute } from "next";
import { NAV_ITEMS } from "@/config/nav";
import { site } from "@/config/site";

/** Derived from NAV_ITEMS, so a page added to the nav is indexed automatically. */
export default function sitemap(): MetadataRoute.Sitemap {
  return NAV_ITEMS.map((item) => ({
    url: new URL(item.href, site.url).toString(),
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: item.href === "/" ? 1 : 0.8,
  }));
}
