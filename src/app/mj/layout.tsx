import type { Metadata } from "next";

/**
 * /mj is unlisted: kept out of NAV_ITEMS (so out of the header and the
 * sitemap) and marked noindex here and via X-Robots-Tag in next.config.ts.
 * Deliberately not in robots.txt — that file is public and would name it.
 */
export const metadata: Metadata = {
  // absolute skips the site-wide "%s · Shane Chan" template; subpages get
  // "诈胡 · 372A MJ" from the template here instead.
  title: { absolute: "372A MJ", template: "%s · 372A MJ" },
  description: "Private mahjong ledger.",
  robots: { index: false, follow: false, nocache: true },
};

export default function MjLayout({ children }: LayoutProps<"/mj">) {
  return <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">{children}</div>;
}
