// src/app/songs/new/page.tsx
import { requireRole } from "@/libs/auth";
import SongsClient from "./SongsClient";

export const dynamic = "force-dynamic";

export default async function NewSongPage() {
  // Nếu muốn chỉ admin mới được tạo:
  await requireRole("admin");

  return <SongsClient />;
}
