import { NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";

export async function GET(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  const ps = await prisma.paymentSession.findUnique({
    where: { sessionId: params.sessionId },
    select: { sessionId: true, status: true, amount: true, songId: true, userId: true },
  });
  if (!ps) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(ps);
}
