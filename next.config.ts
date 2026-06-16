import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Trace the canonical system prompts (flowmind-prompts/) into the serverless bundles
   * for the AI routes that load them at runtime, so they ship on Vercel. */
  outputFileTracingIncludes: {
    "/api/explain-trace": ["./flowmind-prompts/**"],
    "/api/edit-pipeline": ["./flowmind-prompts/**"],
    "/api/generate-pipeline": ["./flowmind-prompts/**"],
  },
};

export default nextConfig;
