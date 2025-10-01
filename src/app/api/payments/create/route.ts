import { NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { getCurrentUser } from "@/libs/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { songId } = await req.json().catch(() => ({}));
    if (!songId) return NextResponse.json({ error: "songId required" }, { status: 400 });

    const song = await prisma.song.findUnique({ where: { id: Number(songId) } });
    if (!song) return NextResponse.json({ error: "song not found" }, { status: 404 });

    // nếu đã sở hữu, không tạo phiên nữa
    const owned = await prisma.purchase.findFirst({
      where: { userId: user.id, songId: song.id },
    });
    if (owned) return NextResponse.json({ error: "already_owned" }, { status: 409 });

    // ép giá về số nguyên (VND)
    const amount = Math.max(1, Math.round(Number(song.price) || 0));

    const sessionId = crypto.randomUUID();

    const qrPayload = {
      receiver_id: process.env.MEZON_BOT_ID || "mezon-bot",
      receiver_name: process.env.RECEIVER_NAME || "Cobar VN",
      amount,
      note: sessionId,     // dùng để đối soát khi webhook bắn về
      type: "payment",
    };

    // lưu phiên
    const ps = await prisma.paymentSession.create({
      data: {
        sessionId,
        userId: user.id,
        songId: song.id,
        amount,
        status: "pending",
        note: `buy song #${song.id}`,
      },
    });

    return NextResponse.json({
      sessionId: ps.sessionId,
      amount,
      currency: "VND",
      qrPayload,           // FE sẽ render QR từ chuỗi này
      qrString: JSON.stringify(qrPayload),
      expiresIn: 15 * 60,  // gợi ý 15 phút
    });
  } catch (e: any) {
    console.error("payments/create", e);
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}
