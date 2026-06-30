import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/libs/auth";

export const runtime = "nodejs";

const AUDIO_BUCKET = process.env.MUSIC_BUCKET || "music";
const IMAGE_BUCKET = "images";
const MAX_AUDIO = 50 * 1024 * 1024; // 50 MB
const MAX_IMAGE = 5 * 1024 * 1024;  // 5 MB

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!;
  return createClient(url, key);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const type = (form.get("type") as string) || "audio"; // "audio" | "image"

  if (!file) return NextResponse.json({ error: "no file" }, { status: 400 });

  const maxSize = type === "image" ? MAX_IMAGE : MAX_AUDIO;
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: `File too large. Max: ${Math.round(maxSize / 1024 / 1024)}MB` },
      { status: 413 }
    );
  }

  const ext = file.name.split(".").pop() || "bin";
  const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const bucket = type === "image" ? IMAGE_BUCKET : AUDIO_BUCKET;
  const prefix = type === "image" ? "avatars" : "full";
  const path = `${prefix}/${key}.${ext}`;

  const sb = getServiceClient();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await sb.storage.from(bucket).upload(path, buffer, {
    contentType: file.type || (type === "image" ? "image/png" : "application/octet-stream"),
    upsert: false,
  });

  if (error) {
    console.error("[upload] supabase error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (type === "image") {
    const { data } = sb.storage.from(bucket).getPublicUrl(path);
    return NextResponse.json({ path, publicUrl: data.publicUrl });
  }

  return NextResponse.json({ path });
}
