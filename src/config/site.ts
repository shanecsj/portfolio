/**
 * Single source of truth for site-wide identity.
 * `url` is used for metadataBase, the sitemap, and robots.txt.
 */
export const site = {
  name: "Shane Chan",
  tagline: "Placeholder tagline — a short line about what you do",
  description:
    "Placeholder description — one or two sentences for search results and link previews.",
  url: "https://shanecsj.me",
} as const;
