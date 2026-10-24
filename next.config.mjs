/** @type {import('next').NextConfig} */
const nextConfig = { typedRoutes: true, serverExternalPackages: ["pdf-parse", "exceljs", "@prisma/client", "@prisma/adapter-pg", "bullmq", "ioredis", "ws"] };
export default nextConfig;
