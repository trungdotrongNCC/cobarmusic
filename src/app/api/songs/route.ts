import { NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { getCurrentUser } from "@/libs/auth";
import { mkdir, writeFile } from "fs/promises";
import { extname } from "path";
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
    previewPath: s.previewPath,
    avatarPath: s.avatar ?? null, // 👈 thêm avatar
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
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const title = String(form.get("title") || "").trim();
  const description = String(form.get("description") || "").trim();
  const priceStr = String(form.get("price") || "0").trim();
  const genreIdsStr = String(form.get("genreIds") || "[]");

  const preview = form.get("preview") as File | null;
  const full = form.get("full") as File | null;
  const avatar = form.get("avatar") as File | null; // 👈 thêm avatar field

  if (!title || !preview || !full)
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });

  const price = Number(priceStr);
  if (Number.isNaN(price) || price < 0)
    return NextResponse.json({ error: "invalid price" }, { status: 400 });

  let genreIds: number[] = [];
  try {
    const parsed = JSON.parse(genreIdsStr);
    if (Array.isArray(parsed)) {
      genreIds = parsed.map((n: any) => Number(n)).filter(Number.isInteger);
    }
  } catch {}

  const uploadsDir = process.cwd() + "/public/uploads";
  await mkdir(uploadsDir, { recursive: true });

  const pvExt = extname(preview.name || ".mp3") || ".mp3";
  const flExt = extname(full.name || ".mp3") || ".mp3";
  const avExt = avatar ? extname(avatar.name || ".jpg") || ".jpg" : null;

  const pvName = `pv_${crypto.randomUUID()}${pvExt}`;
  const flName = `full_${crypto.randomUUID()}${flExt}`;
  const avName = avatar ? `av_${crypto.randomUUID()}${avExt}` : null;

  const pvBuf = Buffer.from(await preview.arrayBuffer());
  const flBuf = Buffer.from(await full.arrayBuffer());
  await writeFile(`${uploadsDir}/${pvName}`, pvBuf);
  await writeFile(`${uploadsDir}/${flName}`, flBuf);

  if (avatar && avName) {
    const avBuf = Buffer.from(await avatar.arrayBuffer());
    await writeFile(`${uploadsDir}/${avName}`, avBuf);
  }

  const song = await prisma.song.create({
    data: {
      title,
      description: description || null,
      price,
      previewPath: `/uploads/${pvName}`,
      fullPath: `/uploads/${flName}`,
      avatar: avName ? `/uploads/${avName}` : null, // 👈 save avatar
      sellerId: user.id,
      ...(genreIds.length
        ? { genres: { connect: genreIds.map((id) => ({ id })) } }
        : {}),
    },
    include: { genres: true, seller: { select: { id: true, email: true, name: true } } },
  });

  return NextResponse.json(song, { status: 201 });
}
