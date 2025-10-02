// app/api/songs/[id]/stream/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { getCurrentUser } from "@/libs/auth";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
// Nếu dùng app router caching: luôn động để không cache user permissions
export const dynamic = "force-dynamic";

// Đổi qua ENV nếu muốn
const AUDIO_BUCKET = process.env.MUSIC_BUCKET || "music";

// TTL của signed URL (giây)
const SIGNED_TTL = Number(process.env.SIGNED_URL_EXPIRES || 600);

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

    // Lấy song (path + seller)
    const song = await prisma.song.findUnique({
      where: { id: songId },
      select: { id: true, sellerId: true, previewPath: true, fullPath: true },
    });
    if (!song) return NextResponse.json({ error: "song not found" }, { status: 404 });

    // Quyết định objectPath và kiểm quyền nếu nghe full
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

      // Kiểm quyền: người mua, seller, hoặc admin
      const me = await getCurrentUser();
      if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

      const isSeller = me.id === song.sellerId;
      const isAdmin = (me as any)?.role === "admin";

      let isOwner = false;
      if (!isSeller && !isAdmin) {
        const purchased = await prisma.purchase.findFirst({
          where: { userId: me.id, songId: song.id },
          select: { id: true },
        });
        isOwner = !!purchased;
      }

      if (!(isSeller || isAdmin || isOwner)) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: "invalid kind" }, { status: 400 });
    }

    // ENV Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Tên thường dùng là SUPABASE_SERVICE_ROLE_KEY; hỗ trợ cả 2 để linh hoạt.
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "supabase env missing" }, { status: 500 });
    }

    // Server-side client với service role để ký URL bucket private
    const sb = createClient(supabaseUrl, serviceRoleKey);

    // Chuẩn hóa path (loại bỏ slash đầu nếu có)
    const normalizedPath = String(objectPath).replace(/^\/+/, "");

    const { data, error } = await sb.storage
      .from(AUDIO_BUCKET)
      .createSignedUrl(normalizedPath, SIGNED_TTL);

    if (error || !data?.signedUrl) {
      console.error("[stream] createSignedUrl error:", error);
      return NextResponse.json({ error: "failed to sign url" }, { status: 500 });
    }

    // Trả về URL cho <audio src=...>
    return NextResponse.json({ url: data.signedUrl });
  } catch (e: any) {
    console.error("GET /api/songs/[id]/stream error:", e);
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}
