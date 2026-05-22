import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Permite imagens do mesmo domínio (logo local)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
