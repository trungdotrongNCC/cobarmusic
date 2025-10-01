import { NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { SESSION_COOKIE } from "@/libs/auth";

export const runtime = "nodejs";

// Utils
function getNextFromReq(req: Request, bodyNext?: unknown) {
  const url = new URL(req.url);
  const nextQ = url.searchParams.get("next");
  const cand = (typeof bodyNext === "string" && bodyNext) || nextQ || "/";
  // Chống open-redirect: chỉ cho phép path nội bộ
  if (!cand.startsWith("/")) return "/";
  return cand;
}

function wantsRedirect(req: Request, bodyRedirect?: unknown) {
  // Ưu tiên cờ trong body: redirect=true|1
  if (typeof bodyRedirect === "string") {
    const v = bodyRedirect.toLowerCase();
    if (v === "true" || v === "1") return true;
  }
  if (typeof bodyRedirect === "boolean") return bodyRedirect;

  // Nếu Accept chứa text/html (submit form), thường muốn redirect
  const accept = req.headers.get("accept") || "";
  if (accept.includes("text/html")) return true;

  // Mặc định với fetch/json trả JSON
  return false;
}

export async function POST(req: Request) {
  // Hỗ trợ cả form-encoded và JSON
  let email = "";
  let redirectBody: unknown;
  let nextBody: unknown;

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const parsed = await req.json().catch(() => ({} as any));
    email = typeof parsed.email === "string" ? parsed.email.trim() : "";
    redirectBody = parsed.redirect;
    nextBody = parsed.next;
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    email = String(form.get("email") || "").trim();
    redirectBody = form.get("redirect") ?? undefined;
    nextBody = form.get("next") ?? undefined;
  } else {
    // Thử JSON như cũ
    const parsed = await req.json().catch(() => ({} as any));
    email = typeof parsed.email === "string" ? parsed.email.trim() : "";
    redirectBody = parsed.redirect;
    nextBody = parsed.next;
  }

  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "not found" }, { status: 401 });
  }

  // tạo session token
  const token = crypto.randomUUID();
  const maxAgeDays = 7;
  const maxAgeSec = maxAgeDays * 24 * 60 * 60;
  const expiresAt = new Date(Date.now() + maxAgeSec * 1000);

  await prisma.session.create({
    data: { token, userId: user.id, expiresAt },
  });

  const res = wantsRedirect(req, redirectBody)
    ? NextResponse.redirect(new URL(getNextFromReq(req, nextBody), req.url))
    : NextResponse.json({
        ok: true,
        next: getNextFromReq(req, nextBody),
        user: { id: user.id, email: user.email, name: user.name },
      });

  // Set HttpOnly cookie
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSec,
  });

  return res;
}
