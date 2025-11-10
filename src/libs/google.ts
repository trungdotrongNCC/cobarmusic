// libs/google.ts
function mustEnv(k: string) {
  const v = process.env[k];
  if (!v) throw new Error(`Missing ENV ${k}`);
  return v;
}

export function buildGoogleAuthUrl(state = "/") {
  const clientId = mustEnv("MEZON_CLIENT_ID");
  const redirectUri = mustEnv("MEZON_REDIRECT_URI");
  const scope = [
    "openid"
  ].join(" ");

  const url = new URL("https://oauth2.mezon.ai/oauth2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  // url.searchParams.set("access_type", "offline"); // nhận refresh_token lần đầu
  // url.searchParams.set("prompt", "consent");      // buộc hiện consent lần đầu
  url.searchParams.set("state", encodeURIComponent(state));
  return url.toString();
}

export async function exchangeGoogleToken(code: string) {
  const clientId = mustEnv("MEZON_CLIENT_ID");
  const clientSecret = mustEnv("MEZON_CLIENT_SECRET");
  const redirectUri = mustEnv("MEZON_REDIRECT_URI");

  const res = await fetch("https://oauth2.mezon.ai/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      scope: 'openid',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`mezon token exchange failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{
    access_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
    refresh_token?: string;
  }>;
}

export async function getGoogleUserInfo(accessToken: string) {
  const clientId = mustEnv("MEZON_CLIENT_ID");
  const clientSecret = mustEnv("MEZON_CLIENT_SECRET");
  const redirectUri = mustEnv("MEZON_REDIRECT_URI");
  
  const res = await fetch("https://oauth2.mezon.ai/userinfo", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      access_token: accessToken,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`mezon userinfo failed (${res.status}): ${text}`);
  }
  // https://openid.net/specs/openid-connect-basic-1_0.html#StandardClaims
  return res.json() as Promise<{
    sub: string;
    aud: string[];
    auth_time: number;
    email?: string;
    display_name?: string;
    mezon_id: string;
    username: string;
    iss: string;
    iat: number;
    rat: number;
  }>;
}
