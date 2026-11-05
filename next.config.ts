import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root. Without this, Turbopack walks up looking for a
  // lockfile and finds an unrelated one in the home directory.
  turbopack: {
    root: __dirname,
  },
  // PGlite ships WASM + data files; let Node load it rather than bundling.
  // Only used when DATABASE_URL=pglite:… for local testing.
  serverExternalPackages: ["@electric-sql/pglite"],
  // /mj is unlisted. Belt-and-braces with the page's robots metadata, and
  // covers responses that carry no HTML <meta> (redirects, action POSTs).
  async headers() {
    return [
      {
        source: "/mj/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/mj",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
