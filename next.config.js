/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true,
  },
  // When deploying to GitHub Pages under a sub-path (e.g. /online-configurator),
  // set basePath and assetPrefix via PAGES_BASE_PATH env var. Leave empty for custom domains.
  basePath: process.env.PAGES_BASE_PATH || '',
  assetPrefix: process.env.PAGES_BASE_PATH || '',
  // Expose basePath to client code – next/image does NOT auto-prepend basePath in
  // static-export mode (output:'export', unoptimized:true), so images must be prefixed manually.
  env: {
    NEXT_PUBLIC_BASE_PATH: process.env.PAGES_BASE_PATH || '',
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Mitigate rare dev-time chunk cache desyncs on Windows.
      config.cache = false
    }
    return config
  },
}

module.exports = nextConfig
