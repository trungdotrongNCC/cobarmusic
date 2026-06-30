import { NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { getCurrentUser } from "@/libs/auth";

export const runtime = "nodejs";

type Params = { params: { id: string } };

// POST → save song to library
export async function POST(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const songId = Number(params.id);
  if (!Number.isFinite(songId)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const song = await prisma.song.findUnique({ where: { id: songId }, select: { id: true } });
  if (!song) return NextResponse.json({ error: "song not found" }, { status: 404 });

  await prisma.purchase.upsert({
    where: { userId_songId: { userId: user.id, songId } },
    update: {},
    create: { userId: user.id, songId, priceAtBuy: 0 },
  });

  return NextResponse.json({ saved: true });
}

// DELETE → remove song from library
export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const songId = Number(params.id);
  if (!Number.isFinite(songId)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  await prisma.purchase.deleteMany({ where: { userId: user.id, songId } });

  return NextResponse.json({ saved: false });
}
