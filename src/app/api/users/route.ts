import { NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";

export const runtime = "nodejs"; // Prisma cần Node runtime (không chạy ở Edge)

export async function GET() {
  const users = await prisma.user.findMany({
    orderBy: { id: "desc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.email !== "string" || !body.email.trim()) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  try {
    const created = await prisma.user.create({
      data: { email: body.email.trim(), name: body.name ?? null },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "email exists?" }, { status: 409 });
  }
}
