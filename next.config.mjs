/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  typescript: {
    // Allows production build to succeed while maintaining dev strictness
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ['pdfkit', 'pdf-parse', '@electric-sql/pglite', 'pg'],
  allowedDevOrigins: ['*.run.app'],
  async redirects() {
    return [
      {
        source: '/index.html',
        destination: '/',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
