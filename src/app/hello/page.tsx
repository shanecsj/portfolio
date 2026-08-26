import type { Metadata } from "next";

/**
 * Template for a new page. To add shanecsj.dev/newfeature:
 *   1. copy this folder to src/app/newfeature/
 *   2. add { href: "/newfeature", label: "New feature" } to src/config/nav.ts
 *
 * If the page needs a backend, add src/app/api/newfeature/route.ts exporting
 * GET/POST — it runs serverless on Vercel with no extra infrastructure.
 */
export const metadata: Metadata = {
  title: "Hello",
  description: "Route template used to verify sub-path routing.",
};

export default function HelloPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Hello</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        This page exists to prove sub-path routing works. Copy{" "}
        <code className="font-mono text-xs text-ink">src/app/hello/</code> to
        start a new feature, or delete it once you have a real one.
      </p>
    </div>
  );
}
