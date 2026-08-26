import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root. Without this, Turbopack walks up looking for a
  // lockfile and finds an unrelated one in the home directory.
  turbopack: {
    root: __dirname,
  },

  async redirects() {
    return [
      // /eatwhere shipped to production and reached the sitemap before being
      // renamed. 308 so anything that already links to it still lands.
      { source: "/eatwhere", destination: "/eatwhat", permanent: true },
    ];
  },
};

export default nextConfig;
