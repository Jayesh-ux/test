import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remove the deprecated appDir option
  // experimental: {
  //   appDir: true, // This is deprecated in Next.js 15
  // },
  
  // Add other configurations if needed
  images: {
    domains: ['localhost'],
  },
  
  // Enable strict mode
  reactStrictMode: true,
  
  // Add environment variables validation
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
};

export default nextConfig;
