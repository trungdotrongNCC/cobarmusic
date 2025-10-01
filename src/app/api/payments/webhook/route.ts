import { NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { Prisma } from "@prisma/client"; // <-- thêm để dùng Prisma.Decimal

type WebhookBody = {
  event_type: "authorized_amount" | "success" | string;
  amount: number;
  metadata?: { session_id?: string; [k: string]: any };
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as WebhookBody;

    const sessionId = body?.metadata?.session_id;
    if (!sessionId) {
      return NextResponse.json({ error: "missing session_id" }, { status: 400 });
    }

    const ps = await prisma.paymentSession.findUnique({ where: { sessionId } });
    if (!ps) {
      return NextResponse.json({ error: "session not found" }, { status: 404 });
    }

    // Xác thực số tiền (nếu cần làm tròn thì thay đổi điều kiện ở đây)
    if (typeof body.amount === "number" && body.amount > 0 && body.amount !== ps.amount) {
      return NextResponse.json({ error: "amount_mismatch" }, { status: 400 });
    }

    if (body.event_type === "authorized_amount") {
      await prisma.paymentSession.update({
        where: { sessionId },
        data: { status: "authorized" },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.event_type === "success") {
      // Idempotent: nếu đã captured thì bỏ qua
      if (ps.status !== "captured") {
        await prisma.$transaction(async (tx) => {
          // cập nhật trạng thái session
          await tx.paymentSession.update({
            where: { sessionId },
            data: { status: "captured" },
          });

          // tạo Purchase nếu chưa có — map amount -> priceAtBuy
          const existing = await tx.purchase.findFirst({
            where: { userId: ps.userId, songId: ps.songId },
          });

          if (!existing) {
            await tx.purchase.create({
              data: {
                userId: ps.userId,
                songId: ps.songId,
                // dùng amount từ webhook (body.amount) để lưu vào priceAtBuy
                priceAtBuy: new Prisma.Decimal(body.amount),
              },
            });
          }
        });
      }

      return NextResponse.json({ ok: true });
    }

    // Event khác: coi như bỏ qua nhưng trả ok (tránh retry)
    return NextResponse.json({ ok: true, ignored: true });
  } catch (e: any) {
    console.error("payments/webhook", e);
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}
