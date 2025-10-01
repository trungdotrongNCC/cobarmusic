import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/libs/prisma";
import { SESSION_COOKIE } from "@/libs/auth";
import { exchangeGoogleToken, getGoogleUserInfo } from "@/libs/google";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });

    // 1) Đổi code lấy access_token
    const tok = await exchangeGoogleToken(code);

    // 2) Lấy thông tin user từ Google
    const info = await getGoogleUserInfo(tok.access_token);

    // 3) Upsert user local theo email (Google luôn có email nếu scope email)
    const email = info.email ?? `google_${info.sub}@example.invalid`;
    const name = info.name || email.split("@")[0];
    const avatarUrl = info.picture;

    const user = await prisma.user.upsert({
      where: { email },
      update: { name, avatarUrl },
      create: { email, name, avatarUrl },
    });

    // 4) Tạo session app
    const sessionToken = crypto.randomUUID();
    const maxAgeDays = 7;
    await prisma.session.create({
      data: {
        token: sessionToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + maxAgeDays * 86400 * 1000),
      },
    });

    const res = NextResponse.redirect(new URL("/", req.url));
    res.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: maxAgeDays * 86400,
    });

    // 5) Quay lại trang trước
    const c = await cookies();
    const back = c.get("oauth_back")?.value || "/";
    c.set("oauth_back", "", { maxAge: -1, path: "/" });
    res.headers.set("Location", back);
    return res;
  } catch (err: any) {
    console.error("google/callback error:", err?.message || err);
    return NextResponse.json({ error: err?.message || "callback failed" }, { status: 500 });
  }
}
