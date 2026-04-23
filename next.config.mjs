/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
    ],
  },
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
      preventFullImport: true,
    },
  },
  experimental: {
    serverComponentsExternalPackages: [
      'firebase-admin',
      '@google-cloud/storage',
      'fluent-ffmpeg',
      'ffmpeg-static',
      '@ffmpeg-installer/ffmpeg',
      '@ffprobe-installer/ffprobe',
      // v2.4 — exiftool-vendored ships a bundled Perl + exiftool binary.
      // Must be marked external so Next's webpack doesn't try to bundle the
      // perl script / .exiftool directory. Same pattern as ffmpeg/ffprobe.
      'exiftool-vendored',
      'exiftool-vendored.pl',
    ],
    outputFileTracingIncludes: {
      '/api/assets/*/generate-sprite': [
        './node_modules/ffmpeg-static/**',
        './node_modules/@ffmpeg-installer/**',
      ],
      '/api/assets/*/probe': [
        './node_modules/@ffmpeg-installer/**',
        './node_modules/ffmpeg-static/**',
        './node_modules/@ffprobe-installer/**',
      ],
      '/api/exports': [
        './node_modules/ffmpeg-static/**',
        './node_modules/@ffmpeg-installer/**',
      ],
      '/api/exports/*': [
        './node_modules/ffmpeg-static/**',
        './node_modules/@ffmpeg-installer/**',
      ],
      // v2.4 — exiftool-vendored's dynamic perl binary path + the custom
      // XMP .config file must be traced for the stamp + spike routes or
      // @vercel/nft misses them and the Lambda deploys with ENOENT.
      '/api/spike/exiftool-version': [
        './node_modules/exiftool-vendored/**',
        './node_modules/exiftool-vendored.pl/**',
      ],
      '/api/assets/*/stamp-metadata': [
        './node_modules/exiftool-vendored/**',
        './node_modules/exiftool-vendored.pl/**',
        './src/lib/metadata-stamp/**',
      ],
    },
  },
};

export default nextConfig;
