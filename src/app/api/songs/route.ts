import { NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { getCurrentUser } from "@/libs/auth";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

/** ---------------------- GET /api/songs ----------------------- */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const q = (searchParams.get("q") || "").trim();
  const limitRaw = parseInt(searchParams.get("limit") || "50", 10);
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));
  const take = Math.min(Math.max(limitRaw, 1), 100);

  const where: Prisma.SongWhereInput | undefined = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      }
    : undefined;

  const user = await getCurrentUser();

  let ownedIds = new Set<number>();
  if (user) {
    const purchases = await prisma.purchase.findMany({
      where: { userId: user.id },
      select: { songId: true },
    });
    ownedIds = new Set(purchases.map((p) => p.songId));
  }

  const [rows, total] = await Promise.all([
    prisma.song.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip: offset,
      include: {
        genres: true,
        seller: { select: { id: true, email: true, name: true } },
      },
    }),
    prisma.song.count({ where }),
  ]);

  const items = rows.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    price: s.price,
    listens: s.listens,
    createdAt: s.createdAt,
    previewPath: s.previewPath,   // private path trong Supabase
    avatarUrl: s.avatar ?? null,  // public URL Supabase (images bucket)
    genres: s.genres.map((g) => ({ id: g.id, name: g.name })),
    seller: s.seller
      ? { id: s.seller.id, email: s.seller.email, name: s.seller.name }
      : null,
    owned: ownedIds.has(s.id),
  }));

  return NextResponse.json({ items, total, limit: take, offset });
}

/** ---------------------- POST /api/songs ---------------------- */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      title,
      description,
      price,
      previewPath,
      fullPath,
      avatarUrl,
      genreIds = [],
    } = body;

    if (!title || !previewPath || !fullPath) {
      return NextResponse.json(
        { error: "missing required fields" },
        { status: 400 }
      );
    }

    const song = await prisma.song.create({
      data: {
        title,
        description: description || null,
        price: Number(price) || 0,
        previewPath, // PATH trong bucket private
        fullPath,    // PATH trong bucket private
        avatar: avatarUrl || null, // public URL (ảnh)
        sellerId: user.id,
        ...(genreIds.length
          ? { genres: { connect: genreIds.map((id: number) => ({ id })) } }
          : {}),
      },
      include: {
        genres: true,
        seller: { select: { id: true, email: true, name: true } },
      },
    });

    return NextResponse.json(song, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/songs error:", err);
    return NextResponse.json(
      { error: err?.message || "server error" },
      { status: 500 }
    );
  }
}
