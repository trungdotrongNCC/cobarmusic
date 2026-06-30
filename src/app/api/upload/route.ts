import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/libs/auth";

export const runtime = "nodejs";

const AUDIO_BUCKET = process.env.MUSIC_BUCKET || "music";
const IMAGE_BUCKET = "images";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!;
  return createClient(url, key);
}

// POST /api/upload
// Body: { filename: string, type: "audio" | "image" }
// Returns: { signedUrl, path, publicUrl? }
// Browser then uploads the file directly to signedUrl (PUT)
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { filename, type = "audio" } = await req.json();
  if (!filename) return NextResponse.json({ error: "filename required" }, { status: 400 });

  const ext = String(filename).split(".").pop() || "bin";
  const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const prefix = type === "image" ? "avatars" : "full";
  const path = `${prefix}/${key}.${ext}`;
  const bucket = type === "image" ? IMAGE_BUCKET : AUDIO_BUCKET;

  const sb = getServiceClient();
  const { data, error } = await sb.storage.from(bucket).createSignedUploadUrl(path);

  if (error || !data) {
    console.error("[upload/presign] error:", error);
    return NextResponse.json({ error: error?.message || "failed to create upload url" }, { status: 500 });
  }

  const result: Record<string, string> = { signedUrl: data.signedUrl, path };

  if (type === "image") {
    const { data: pub } = sb.storage.from(bucket).getPublicUrl(path);
    result.publicUrl = pub.publicUrl;
  }

  return NextResponse.json(result);
}
