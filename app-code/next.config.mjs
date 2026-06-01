/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone build cho Docker — chỉ copy code + node_modules tối thiểu
  // vào image, giảm size từ ~1GB xuống ~200MB
  output: 'standalone',

  experimental: {
    serverActions: { bodySizeLimit: '10mb' }
  },

  // M4: Security headers cho mọi route. HSTS bật khi ENABLE_HSTS=1 (production HTTPS).
  async headers() {
    const security = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
      { key: 'X-DNS-Prefetch-Control', value: 'off' }
    ];
    if (process.env.ENABLE_HSTS === '1') {
      security.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload'
      });
    }
    return [
      { source: '/(.*)', headers: security },
      { source: '/api/(.*)', headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }] }
    ];
  },

  webpack: (config) => {
    config.externals = [...(config.externals || []), 'bcryptjs'];
    return config;
  }
};

export default nextConfig;
