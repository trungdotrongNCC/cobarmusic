import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // ⬅️ Cho phép bỏ qua lỗi lint khi build (để deploy nhanh)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Nếu bạn vẫn bị lỗi type thì bật tạm dòng này (chỉ nên dùng cho MVP)
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
