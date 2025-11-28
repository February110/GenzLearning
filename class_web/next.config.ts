import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // Tối ưu cho Docker deployment
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.dicebear.com", pathname: "/**" },
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "http", hostname: "localhost", port: "5081", pathname: "/uploads/**" },
      { protocol: "http", hostname: "class_api", port: "8080", pathname: "/uploads/**" },
    ],
  },
};

export default nextConfig;
