import { NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUDIO_BUCKET = process.env.MUSIC_BUCKET || "music";
const SIGNED_TTL = Number(process.env.SIGNED_URL_EXPIRES || 600);

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
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "supabase env missing" }, { status: 500 });
    }

    const normalizedPath = objectPath.replace(/^\/+/, "");

    // Direct REST call — avoids SDK fetch wrapper that fails on some Vercel regions
    const signRes = await fetch(
      `${supabaseUrl}/storage/v1/object/sign/${AUDIO_BUCKET}/${normalizedPath}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expiresIn: SIGNED_TTL }),
      }
    );

    if (!signRes.ok) {
      const detail = await signRes.text().catch(() => signRes.statusText);
      console.error("[stream] sign REST error:", signRes.status, detail);
      return NextResponse.json(
        { error: "failed to sign url", detail, bucket: AUDIO_BUCKET, path: normalizedPath },
        { status: 500 }
      );
    }

    const json = await signRes.json();
    // Supabase returns { signedURL: "/storage/v1/object/sign/bucket/path?token=xxx" }
    const signedPath: string = json.signedURL ?? json.signedUrl ?? "";
    if (!signedPath) {
      return NextResponse.json({ error: "empty signed url", raw: json }, { status: 500 });
    }

    // Supabase REST returns "/object/sign/..." — need to add "/storage/v1" prefix
    const fullSignedUrl = signedPath.startsWith("http")
      ? signedPath
      : signedPath.startsWith("/storage/v1")
        ? `${supabaseUrl}${signedPath}`
        : `${supabaseUrl}/storage/v1${signedPath}`;

    return NextResponse.json({ url: fullSignedUrl });
  } catch (e: any) {
    console.error("GET /api/songs/[id]/stream error:", e);
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}
