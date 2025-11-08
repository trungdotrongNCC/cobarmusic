const MEZON_AUTH_BASE = "https://oauth2.mezon.ai/oauth2/auth";
const MEZON_TOKEN_URL = "https://oauth2.mezon.ai/oauth2/token";
const MEZON_USERINFO_URL = "https://oauth2.mezon.ai/userinfo";

function mustEnv(k: string) {
  const v = process.env[k];
  if (!v) throw new Error(`Missing ENV ${k}`);
  return v;
}

export function buildMezonAuthUrl(state: string) {
  const clientId = mustEnv("MEZON_CLIENT_ID");
  const redirectUri = mustEnv("MEZON_REDIRECT_URI");
  const scope = ["openid", "offline"].join(" ");

  const url = new URL(MEZON_AUTH_BASE);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeMezonToken(code: string, state: string) {
  const clientId = mustEnv("MEZON_CLIENT_ID");
  const clientSecret = mustEnv("MEZON_CLIENT_SECRET");
  const redirectUri = mustEnv("MEZON_REDIRECT_URI");

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    state,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(MEZON_TOKEN_URL, {
    method: "POST",
    headers,
    body: params,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`mezon token exchange failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  }>;
}

export async function getMezonUserInfo(accessToken: string) {
  const res = await fetch(MEZON_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`mezon userinfo failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<{
    sub: string;
    email?: string;
    preferred_username?: string;
    name?: string;
    picture?: string;
  }>;
}

