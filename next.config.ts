import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SITE_ADMINS: process.env.SITE_ADMIN ?? "",
  },
};

export default nextConfig;
