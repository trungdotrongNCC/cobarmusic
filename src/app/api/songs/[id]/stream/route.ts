import { NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUDIO_BUCKET = process.env.MUSIC_BUCKET || "music";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const kind = (url.searchParams.get("kind") || "full").toLowerCase();

    const songId = Number(id);
    if (!Number.isFinite(songId)) {
      return NextResponse.json({ error: "invalid id" }, { status: 400 });
    }

    const song = await prisma.song.findUnique({
      where: { id: songId },
      select: { previewPath: true, fullPath: true },
    });
    if (!song) return NextResponse.json({ error: "song not found" }, { status: 404 });

    const objectPath = kind === "preview" ? song.previewPath : song.fullPath;
    if (!objectPath) {
      return NextResponse.json({ error: `${kind} not available` }, { status: 404 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return NextResponse.json({ error: "supabase env missing" }, { status: 500 });
    }

    const normalizedPath = objectPath.replace(/^\/+/, "");

    // Public bucket — construct URL locally, no outbound HTTP needed.
    // (Supabase Storage API is IPv6-only from Vercel's egress, which fails.)
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${AUDIO_BUCKET}/${normalizedPath}`;

    return NextResponse.json({ url: publicUrl });
  } catch (e: any) {
    console.error("GET /api/songs/[id]/stream error:", e);
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}
