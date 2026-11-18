import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NEXT_STATIC=1 is used only by scripts/check-static-build.mjs (the Capacitor-ready build, spec 10.6.1).
  ...(process.env.NEXT_STATIC ? { output: "export" as const, images: { unoptimized: true } } : {}),
};

export default nextConfig;
