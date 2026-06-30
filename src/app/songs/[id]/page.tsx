import { prisma } from "@/libs/prisma";
import { getCurrentUser } from "@/libs/auth";
import SongDetailsClient from "../SongDetailsClient";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

export default async function SongDetailsPage({ params }: PageProps) {
  const songId = Number(params.id);
  if (!Number.isFinite(songId)) notFound();

  // 1) Xác định user & trạng thái đã lưu vào thư viện
  const user = await getCurrentUser();
  let owned = false; // true = đã lưu vào My Songs
  if (user) {
    const saved = await prisma.purchase.findFirst({
      where: { userId: user.id, songId },
      select: { id: true },
    });
    owned = !!saved;
  }

  // 2) Lấy dữ liệu bài hát + comment
  const s = await prisma.song.findUnique({
    where: { id: songId },
    include: {
      genres: true,
      seller: { select: { id: true, email: true, name: true } },
      comments: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!s) notFound();

  // 3) Chuẩn hoá dữ liệu gửi sang client
  const initialSong = {
    id: s.id,
    title: s.title,
    description: s.description,
    lyric: s.lyric ?? "",
    avatar: s.avatar,
    price: s.price.toString(),
    listens: s.listens,
    createdAt: s.createdAt.toISOString(),
    genres: s.genres.map((g) => ({ id: g.id, name: g.name })),
    seller: s.seller
      ? { id: s.seller.id, email: s.seller.email, name: s.seller.name }
      : null,
    owned,
    previewPath: s.previewPath,
    fullPath: s.fullPath,
    comments: s.comments.map((c) => ({
      id: c.id,
      content: c.content,
      user: c.user
        ? { id: c.user.id, name: c.user.name ?? c.user.email }
        : null,
      createdAt: c.createdAt.toISOString(),
    })),
  };

  // 4) Render trang
  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px 120px" }}>
        <h1 className="text-3xl md:text-[42px] font-semibold tracking-tight mb-3">
          Song Details
        </h1>
        <SongDetailsClient initialSong={initialSong} />
      </div>
    </div>
  );
}
