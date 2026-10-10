/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Allows production build to succeed while maintaining dev strictness
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ['pdfkit', 'pdf-parse'],
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
