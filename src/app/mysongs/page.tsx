// src/app/mysongs/page.tsx
import { prisma } from "@/libs/prisma";
import { getCurrentUser } from "@/libs/auth";
import { redirect } from "next/navigation";
import MySongsClient from "./MySongsClient";

export const dynamic = "force-dynamic";

export default async function MySongsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/mysongs");
  }

  // Lấy các bài user đã mua (full)
  const purchases = await prisma.purchase.findMany({
    where: { userId: user.id },
    orderBy: { purchasedAt: "desc" },
    include: {
      song: {
        include: {
          genres: true,
          seller: { select: { id: true, email: true, name: true } },
        },
      },
    },
  });

  const initialSongs = purchases.map((p) => {
    const s = p.song;
    return {
      id: s.id,
      title: s.title,
      description: s.description,
      price: s.price.toString(),
      avatar: s.avatar,
      listens: s.listens,
      createdAt: s.createdAt.toISOString(),
      genres: s.genres.map((g) => ({ id: g.id, name: g.name })),
      seller: s.seller ? { id: s.seller.id, email: s.seller.email, name: s.seller.name } : null,
      playUrl: s.fullPath,     // 👈 phát bản FULL
    };
  });

  return <MySongsClient initialSongs={initialSongs} />;
}
