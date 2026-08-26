/**
 * Single source of truth for site-wide identity.
 * `url` is used for metadataBase, the sitemap, and robots.txt.
 */
export const site = {
  name: "Shane Chan",
  tagline: "Lead Backend Developer",
  description:
    "Lead Backend Developer at the Defence Science and Technology Agency, building scalable microservices on AWS.",
  url: "https://shanecsj.dev",
} as const;
