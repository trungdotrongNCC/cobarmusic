import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildMezonAuthUrl } from "@/libs/mezon";

function generateState(length = 11) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let state = "";
  for (let i = 0; i < length; i += 1) {
    state += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return state;
}

export async function GET(req: Request) {
  const required = ["MEZON_CLIENT_ID", "MEZON_CLIENT_SECRET", "MEZON_REDIRECT_URI"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    return NextResponse.json({ error: `Missing ENV: ${missing.join(", ")}` }, { status: 500 });
  }

  const url = new URL(req.url);
  const redirectParam = url.searchParams.get("redirect") || "/";
  const state = generateState();

  const store = await cookies();
  store.set("oauth_back", redirectParam, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
  store.set("oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });

  const authUrl = buildMezonAuthUrl(state);
  return NextResponse.redirect(authUrl);
}

