/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Allows production build to succeed while maintaining dev strictness
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ['pdfkit', 'pdf-parse'],
};

export default nextConfig;
