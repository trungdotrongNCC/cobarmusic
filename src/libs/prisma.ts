import { PrismaClient } from "@prisma/client";

// Dùng biến global để giữ 1 PrismaClient duy nhất (tránh tạo nhiều khi hot reload)
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query", "error", "warn"], // hiện log khi chạy query
  });

// Nếu không phải production => gắn vào global để tái sử dụng
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
