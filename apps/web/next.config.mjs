/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Internal workspace packages are consumed as TypeScript source.
  transpilePackages: ["@axona/db", "@axona/agents", "@axona/config"],
};

export default nextConfig;
