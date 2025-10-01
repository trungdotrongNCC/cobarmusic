// src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { SESSION_COOKIE } from "@/libs/auth";

export async function POST(req: Request) {
  const cookieHeader = req.headers.get("cookie") || "";
  const token = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${SESSION_COOKIE}=`))
    ?.split("=")[1];

  if (token) {
    await prisma.session.deleteMany({ where: { token } }).catch(() => {});
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: -1 });
  return res;
}
