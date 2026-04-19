import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Type validation already runs in CI / IDE — skip it during the production
  // build to shave seconds off `next build` on the server.
  // (Next.js 16 no longer runs ESLint during build, so no `eslint` flag needed.)
  typescript: {
    ignoreBuildErrors: true,
  },

  // Keep yahoo-finance2 out of the bundler. It pulls in a lot of incidental
  // dependencies, throws warnings about Node version, and is only used on the
  // server. Marking it external means Next never tries to trace / minify it,
  // which speeds up build *and* startup.
  serverExternalPackages: ["yahoo-finance2"],

  // Tree-shake huge "barrel" packages so each route only bundles the icons /
  // chart components / motion primitives it actually uses. Cuts both build
  // time and per-route JS payload significantly.
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "framer-motion",
      "@base-ui/react",
      "cmdk",
    ],
  },

  // Strip console.* (except errors / warns) from the production client bundle.
  // Smaller bundle → faster first paint → faster perceived load on reboot.
  compiler: {
    removeConsole: {
      exclude: ["error", "warn"],
    },
  },

  // Standard production hardening — saves a tiny bit of bandwidth.
  poweredByHeader: false,
  productionBrowserSourceMaps: false,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "flagcdn.com",
        pathname: "/w40/**",
      },
    ],
  },
};

export default nextConfig;
