import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.vercel.run", "preview-check.vercel.run"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverExternalPackages: ["node:sqlite", "pdfkit"],
  outputFileTracingIncludes: {
    "/api/pdf/**": ["./assets/fonts/**"],
  },
};

export default nextConfig;
