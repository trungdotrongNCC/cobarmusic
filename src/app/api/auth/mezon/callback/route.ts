import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/libs/prisma";
import { SESSION_COOKIE } from "@/libs/auth";
import { exchangeMezonToken, getMezonUserInfo } from "@/libs/mezon";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code) {
      return NextResponse.json({ error: "missing code" }, { status: 400 });
    }
    if (!state) {
      return NextResponse.json({ error: "missing state" }, { status: 400 });
    }

    const store = await cookies();
    const savedState = store.get("oauth_state")?.value;
    if (!savedState || savedState !== state) {
      return NextResponse.json({ error: "invalid state" }, { status: 400 });
    }

    const tok = await exchangeMezonToken(code, state);
    const info = await getMezonUserInfo(tok.access_token);

    const email = info.email ?? `mezon_${info.sub}@example.invalid`;
    const name = info.name || info.preferred_username || email.split("@")[0];
    const avatarUrl = info.picture ?? null;

    const user = await prisma.user.upsert({
      where: { email },
      update: { name, avatarUrl, mezonId: info.sub },
      create: { email, name, avatarUrl, mezonId: info.sub },
    });
    console.log("[mezon/callback] upserted user:", { id: user.id, email: user.email });

    const sessionToken = crypto.randomUUID();
    const maxAgeDays = 7;

    await prisma.session.create({
      data: {
        token: sessionToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + maxAgeDays * 86400 * 1000),
      },
    });

    const back = store.get("oauth_back")?.value || "/";

    const res = NextResponse.redirect(new URL(back, req.url), 302);
    res.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: maxAgeDays * 86400,
    });
    res.cookies.set("oauth_back", "", { maxAge: 0, path: "/" });
    res.cookies.set("oauth_state", "", { maxAge: 0, path: "/" });

    return res;
  } catch (err: any) {
    console.error("mezon/callback error:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "callback failed" },
      { status: 500 },
    );
  }
}

