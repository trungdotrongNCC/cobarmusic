// libs/google.ts
function mustEnv(k: string) {
  const v = process.env[k];
  if (!v) throw new Error(`Missing ENV ${k}`);
  return v;
}

export function buildGoogleAuthUrl(state = "/") {
  const clientId = mustEnv("GOOGLE_CLIENT_ID");
  const redirectUri = mustEnv("GOOGLE_REDIRECT_URI");
  const scope = [
    "openid",
    "email",
    "profile",
  ].join(" ");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("access_type", "offline"); // nhận refresh_token lần đầu
  url.searchParams.set("prompt", "consent");      // buộc hiện consent lần đầu
  url.searchParams.set("state", encodeURIComponent(state));
  return url.toString();
}

export async function exchangeGoogleToken(code: string) {
  const clientId = mustEnv("GOOGLE_CLIENT_ID");
  const clientSecret = mustEnv("GOOGLE_CLIENT_SECRET");
  const redirectUri = mustEnv("GOOGLE_REDIRECT_URI");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`google token exchange failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{
    access_token: string;
    id_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  }>;
}

export async function getGoogleUserInfo(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`google userinfo failed (${res.status}): ${text}`);
  }
  // https://openid.net/specs/openid-connect-basic-1_0.html#StandardClaims
  return res.json() as Promise<{
    sub: string;       // Google user id
    email?: string;
    email_verified?: boolean;
    name?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
  }>;
}
