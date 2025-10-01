// src/app/api/secure/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/libs/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ secret: "Only for logged-in users", email: user.email });
}
