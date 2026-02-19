/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    if (dev) {
      // Mitigate rare dev-time chunk cache desyncs on Windows.
      config.cache = false
    }
    return config
  },
}

module.exports = nextConfig
