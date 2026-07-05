/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Internal workspace packages are consumed as TypeScript source.
  transpilePackages: ["@axona/db", "@axona/agents", "@axona/config"],
  experimental: {
    // FILE.2 text extractors are server-only (worker + API routes) and pull Node
    // built-ins (fs) their bundlers can't satisfy — keep them external so
    // `next build` never bundles them into a route/server graph.
    serverComponentsExternalPackages: [
      "pdf-parse",
      "mammoth",
      "@anthropic-ai/sdk",
    ],
  },
  webpack: (config, { isServer }) => {
    // The @axona/db barrel transitively references pdf-parse/mammoth (FILE.2). They
    // only ever run server-side (behind route handlers / the worker), but the module
    // graph reaches the client bundle — stub the Node built-ins there so `next build`
    // doesn't fail on `Can't resolve 'fs'`. The code paths that use them never run in
    // the browser.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        stream: false,
        zlib: false,
      };
    }
    return config;
  },
};

export default nextConfig;
