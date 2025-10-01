// src/components/LeftSidebar.jsx
import { cookies } from "next/headers";
import { prisma } from "@/libs/prisma";
import { SESSION_COOKIE } from "@/libs/auth";
import LeftSidebarClient from "./LeftSidebarClient";

export const runtime = "nodejs";

export default async function LeftSidebar() {
  const token = cookies().get(SESSION_COOKIE)?.value || null;

  let me = null;
  if (token) {
    // Tìm session + user theo token
    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            email: true,
            name: true,
            avatarUrl: true,
            // ❌ KHÔNG còn select credits vì schema không có cột này
          },
        },
      },
    });

    const notExpired =
      !session?.expiresAt || new Date(session.expiresAt).getTime() > Date.now();

    if (session?.user && notExpired) {
      me = {
        email: session.user.email,
        name: session.user.name,
        avatar: session.user.avatarUrl || null,
        credits: 0, // mặc định 0 vì schema không có cột credits
      };
    }
  }

  return <LeftSidebarClient me={me} />;
}
