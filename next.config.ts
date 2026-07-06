import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  outputFileTracingIncludes: {
    "/api/ingest": [
      "node_modules/pdf-parse/**/*",
      "node_modules/pdfjs-dist/**/*",
    ],
  },
};

export default nextConfig;
