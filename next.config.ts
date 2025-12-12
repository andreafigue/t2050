import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ['lucide-react'],
  turbopack:{
    root: __dirname,
  },
};

module.exports = nextConfig;

export default nextConfig;