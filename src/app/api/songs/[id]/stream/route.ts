import { NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { getCurrentUser } from "@/libs/auth";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Có thể đổi qua ENV nếu muốn: MUSIC_BUCKET
const AUDIO_BUCKET = process.env.MUSIC_BUCKET || "music";

/**
 * GET /api/songs/:id/stream?kind=preview|full
 * Trả { url } là signed URL (Supabase) có hạn (mặc định 10 phút)
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const url = new URL(req.url);
    const kind = (url.searchParams.get("kind") || "preview").toLowerCase(); // preview | full
    const songId = Number(params.id);
    if (!Number.isFinite(songId)) {
      return NextResponse.json({ error: "invalid id" }, { status: 400 });
    }

    // Lấy song (lấy path + sellerId)
    const song = await prisma.song.findUnique({
      where: { id: songId },
      select: {
        id: true,
        sellerId: true,
        previewPath: true,
        fullPath: true,
      },
    });

    if (!song) {
      return NextResponse.json({ error: "song not found" }, { status: 404 });
    }

    let objectPath: string | null = null;

    if (kind === "preview") {
      objectPath = song.previewPath || null;
      if (!objectPath) {
        return NextResponse.json({ error: "preview not available" }, { status: 404 });
      }
    } else if (kind === "full") {
      objectPath = song.fullPath || null;
      if (!objectPath) {
        return NextResponse.json({ error: "full not available" }, { status: 404 });
      }

      // Kiểm tra quyền nghe full: đã mua, là seller, hoặc admin
      const me = await getCurrentUser(); // đảm bảo hàm này trả { id, role? }
      if (!me) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }

      const isSeller = me.id === song.sellerId;
      const isAdmin = (me as any).role === "admin";

      let isOwner = false;
      if (!isSeller && !isAdmin) {
        const purchase = await prisma.purchase.findFirst({
          where: { userId: me.id, songId: song.id },
          select: { id: true },
        });
        isOwner = !!purchase;
      }

      if (!(isSeller || isAdmin || isOwner)) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: "invalid kind" }, { status: 400 });
    }

    // Tạo signed URL bằng Service Role (server-only)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE!;
    if (!supabaseUrl || !serviceRole) {
      return NextResponse.json(
        { error: "supabase env missing" },
        { status: 500 }
      );
    }

    const sb = createClient(supabaseUrl, serviceRole);
    // thời hạn 10 phút (600s) — bạn đổi theo ý muốn
    const expiresIn = Number(process.env.SIGNED_URL_EXPIRES || 600);

    const { data, error } = await sb.storage
      .from(AUDIO_BUCKET)
      .createSignedUrl(objectPath!, expiresIn);

    if (error || !data?.signedUrl) {
      console.error("[stream] createSignedUrl error:", error);
      return NextResponse.json(
        { error: "failed to sign url" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (e: any) {
    console.error("GET /api/songs/[id]/stream", e);
    return NextResponse.json(
      { error: e?.message || "server error" },
      { status: 500 }
    );
  }
}
