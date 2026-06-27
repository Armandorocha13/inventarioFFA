/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite imagens do mesmo domínio (logo local)
  images: {
    unoptimized: true,
  },
  // Módulos nativos não devem ser empacotados pelo bundler do servidor.
  serverExternalPackages: ['better-sqlite3', 'pg'],
};

export default nextConfig;
