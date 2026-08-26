import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root. Without this, Turbopack walks up looking for a
  // lockfile and finds an unrelated one in the home directory.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
