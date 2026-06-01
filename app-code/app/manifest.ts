import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'QL Kho Lốp',
    short_name: 'QL Kho',
    description: 'Phần mềm quản lý kho lốp xe',
    lang: 'vi',
    start_url: '/',
    display: 'standalone',
    background_color: '#F7F8FA',
    theme_color: '#1E5FB4',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
}
