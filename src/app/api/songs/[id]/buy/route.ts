import { NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { getCurrentUser } from "@/libs/auth";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const songId = Number(params.id);
  if (!Number.isInteger(songId)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const song = await prisma.song.findUnique({ where: { id: songId } });
  if (!song) return NextResponse.json({ error: "song not found" }, { status: 404 });

  // Nếu đã mua rồi thì trả về ok (idempotent)
  const exists = await prisma.purchase.findUnique({
    where: { userId_songId: { userId: user.id, songId } },
  });
  if (exists) return NextResponse.json({ ok: true, owned: true });

  await prisma.purchase.create({
    data: {
      userId: user.id,
      songId,
      priceAtBuy: song.price,
    },
  });

  return NextResponse.json({ ok: true, owned: true });
}
