import { NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { getCurrentUser } from "@/libs/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { content } = await req.json();
  if (!content?.trim()) return new NextResponse("Invalid", { status: 400 });

  const { id } = await params;
  const songId = Number(id);
  const comment = await prisma.comment.create({
    data: { content, songId, userId: user.id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({
    id: comment.id,
    content: comment.content,
    user: { id: comment.user.id, name: comment.user.name ?? comment.user.email },
    createdAt: comment.createdAt.toISOString(),
  });
}
