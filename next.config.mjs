/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Allows production build to succeed while maintaining dev strictness
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ['pdfkit', 'pdf-parse', '@google-cloud/tasks', '@google-cloud/storage'],
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
