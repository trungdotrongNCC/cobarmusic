import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildGoogleAuthUrl } from "@/libs/google";

export async function GET(req: Request) {
  // Kiểm tra ENV tối thiểu
  const required = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    return NextResponse.json({ error: `Missing ENV: ${missing.join(", ")}` }, { status: 500 });
  }

  const url = new URL(req.url);
  const redirectParam = url.searchParams.get("redirect") || "/";

  const c = await cookies();
  c.set("oauth_back", redirectParam, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });

  const authUrl = buildGoogleAuthUrl(redirectParam);
  return NextResponse.redirect(authUrl);
}
