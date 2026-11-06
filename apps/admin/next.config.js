const path = require("node:path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@wave/shared"],
  // The droplet image ships only the traced server files. `next start` (Render,
  // local) doesn't work with standalone output, so it stays opt-in.
  ...(process.env.NEXT_STANDALONE === "1" && {
    output: "standalone",
    experimental: { outputFileTracingRoot: path.join(__dirname, "../..") },
  }),
};

const { withSentryConfig } = require("@sentry/nextjs");

const sentryWebpackPluginOptions = {
  silent: true,
  hideSourceMaps: true,
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
};

module.exports = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
