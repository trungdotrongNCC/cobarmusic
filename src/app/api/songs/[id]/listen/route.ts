import { NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const songId = Number(id);
  if (!Number.isFinite(songId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const cookieName = `ls_${songId}`;
  const cookieHeader = req.headers.get("cookie") || "";
  const alreadyCounted = cookieHeader
    .split(";")
    .some((c) => c.trim().startsWith(`${cookieName}=`));

  const res = new NextResponse(null, { status: 204 });
  if (alreadyCounted) return res;

  try {
    await prisma.song.update({
      where: { id: songId },
      data: { listens: { increment: 1 } },
    });
    res.cookies.set(cookieName, "1", {
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60,
      path: "/",
    });
    return res;
  } catch (e) {
    console.error("listen increment error", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
