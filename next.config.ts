import type { NextConfig } from 'next';
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];
const siteCsp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data:",
  "connect-src 'self' https://graphql.anilist.co https://s4.anilist.co",
  "media-src 'self' blob:",
  "frame-src https://www.youtube-nocookie.com",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');
const config: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [{ source: '/', destination: '/site.html', permanent: false }, { source: '/admin', destination: '/dev', permanent: false }];
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/site.html', headers: [{ key: 'Content-Security-Policy', value: siteCsp }] },
      { source: '/watch.html', headers: [{ key: 'Content-Security-Policy', value: siteCsp }, { key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/dev', headers: [{ key: 'Cache-Control', value: 'private, no-store' }, { key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/api/admin/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};
export default config;
