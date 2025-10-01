import { cookies } from "next/headers";
import { prisma } from "@/libs/prisma";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "session";

export async function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: { select: { id: true, email: true, name: true, role: true, createdAt: true } },
    },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { token } }).catch(() => {});
    return null;
  }
  return session.user;
}

/** Bắt buộc đăng nhập; nếu chưa login => redirect /login */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Bắt buộc role đúng; nếu sai => redirect /403 */
export async function requireRole(required: string | string[]) {
  const user = await requireUser();
  const needs = Array.isArray(required) ? required : [required];
  if (!needs.includes(user.role)) redirect("/403");
  return user;
}
