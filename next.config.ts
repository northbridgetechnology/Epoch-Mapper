import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle (.next/standalone) for a small Docker
  // runtime image — see Dockerfile.
  output: 'standalone',
}

export default nextConfig
