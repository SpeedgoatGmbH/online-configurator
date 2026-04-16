const exportBasePath = process.env.PAGES_BASE_PATH || ''
const isExportBuild = process.env.NEXT_EXPORT === '1' || exportBasePath !== ''

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(isExportBuild ? { output: 'export' } : {}),
  images: {
    unoptimized: true,
  },
  // Keep export-only path rewriting out of `next dev`; it breaks app-router asset URLs there.
  basePath: isExportBuild ? exportBasePath : '',
  assetPrefix: isExportBuild ? exportBasePath : '',
  // Expose the deployment base path to client code for static-export image prefixes.
  env: {
    NEXT_PUBLIC_BASE_PATH: isExportBuild ? exportBasePath : '',
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
