import { NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
export const runtime = "nodejs";

export async function GET() {
  const genres = await prisma.genre.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(genres);
}
