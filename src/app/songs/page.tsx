import { prisma } from "@/libs/prisma";
import { getCurrentUser } from "@/libs/auth";
import SongsListClient from "./SongsListClient";

export const dynamic = "force-dynamic";

export default async function AllSongsPage() {
  // 1) Lấy user hiện tại + danh sách bài đã mua
  const user = await getCurrentUser();

  let ownedIds = new Set<number>();
  if (user) {
    const purchases = await prisma.purchase.findMany({
      where: { userId: user.id },
      select: { songId: true },
    });
    ownedIds = new Set(purchases.map((p) => p.songId));
  }

  // 2) Lấy danh sách bài hát
  const songs = await prisma.song.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      genres: true,
      seller: { select: { id: true, email: true, name: true } },
    },
  });

  // 3) Build initialSongs có sẵn owned + chỉ trả previewPath
  const initialSongs = songs.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    avatar: s.avatar,
    price: s.price.toString(),
    listens: s.listens,
    createdAt: s.createdAt.toISOString(),
    genres: s.genres.map((g) => ({ id: g.id, name: g.name })),
    seller: s.seller ? { id: s.seller.id, email: s.seller.email, name: s.seller.name } : null,
    owned: ownedIds.has(s.id),      // ✅ đánh dấu sở hữu
    previewPath: s.previewPath,     // ✅ chỉ trả preview
  }));

  return <SongsListClient initialSongs={initialSongs} />;
}
