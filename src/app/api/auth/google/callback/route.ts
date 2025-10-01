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
    if (!code) {
      return NextResponse.json({ error: "missing code" }, { status: 400 });
    }

    // 1) Đổi code lấy access_token (nếu hàm exchangeGoogleToken cần redirect_uri, đảm bảo nó dùng GOOGLE_REDIRECT_URI từ env)
    const tok = await exchangeGoogleToken(code);

    // 2) Lấy thông tin user từ Google (đã scope email/profile)
    const info = await getGoogleUserInfo(tok.access_token);
    const email = info.email ?? `google_${info.sub}@example.invalid`;
    const name = info.name || email.split("@")[0];
    const avatarUrl = info.picture ?? null;

    // 3) Upsert user theo email (=> chắc chắn có user trong DB sau login)
    //    YÊU CẦU: model User phải có unique trên email
    const user = await prisma.user.upsert({
      where: { email },
      update: { name, avatarUrl },
      create: { email, name, avatarUrl },
    });
    // Log nhẹ để debug nếu cần
    console.log("[google/callback] upserted user:", { id: user.id, email: user.email });

    // 4) Tạo session app (ghi vào bảng Session và set cookie httpOnly)
    const sessionToken = crypto.randomUUID();
    const maxAgeDays = 7;

    await prisma.session.create({
      data: {
        token: sessionToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + maxAgeDays * 86400 * 1000),
      },
    });

    // 5) Chuẩn bị redirect về trang trước (nếu có cookie oauth_back)
    const store = cookies(); // KHÔNG await
    const back = store.get("oauth_back")?.value || "/";

    const res = NextResponse.redirect(new URL(back, req.url), 302);

    // Set session cookie httpOnly
    res.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: maxAgeDays * 86400,
    });

    // Xoá cookie oauth_back
    res.cookies.set("oauth_back", "", { maxAge: 0, path: "/" });

    return res;
  } catch (err: any) {
    console.error("google/callback error:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "callback failed" },
      { status: 500 },
    );
  }
}
