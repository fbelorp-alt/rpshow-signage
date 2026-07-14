/**
 * NovaStar Taurus local HTTP API — brightness control
 *
 * The Taurus device exposes a REST API on port 7788.
 * The APK runs ON the same device, so we try 127.0.0.1 first,
 * then fall back to the device's own LAN IP (via expo-network).
 *
 * Flow: POST /api/v1/login → token → PUT /api/v1/brightness
 * Token is cached for 5 minutes to avoid hammering the login endpoint.
 */

const PORT = 7788;
const DEFAULT_USER = "admin";
const DEFAULT_PASS = "123456";
const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 min

interface TokenCache {
  host: string;
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

// The player APK runs ON the Taurus device itself, so 127.0.0.1 always works
function getCandidateHosts(): string[] {
  return ["127.0.0.1"];
}

async function loginToHost(host: string, password: string): Promise<string | null> {
  try {
    const res = await fetch(`http://${host}:${PORT}/api/v1/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userName: DEFAULT_USER, password }),
    });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    // Token may be at root or nested under "data"
    const token =
      (data?.token as string | undefined) ??
      ((data?.data as Record<string, unknown>)?.token as string | undefined);
    return token ?? null;
  } catch {
    return null;
  }
}

async function getToken(password: string): Promise<{ host: string; token: string } | null> {
  // Return cached token if still valid
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return { host: tokenCache.host, token: tokenCache.token };
  }

  const hosts = await getCandidateHosts();
  for (const host of hosts) {
    const token = await loginToHost(host, password);
    if (token) {
      tokenCache = { host, token, expiresAt: Date.now() + TOKEN_TTL_MS };
      return { host, token };
    }
  }
  return null;
}

/**
 * Set LED panel brightness via NovaStar local API.
 * @param brightness 0–100 (integer percent)
 * @param password   NovaStar admin password (default "123456")
 * @returns true if command succeeded, false otherwise
 */
export async function novastarSetBrightness(
  brightness: number,
  password = DEFAULT_PASS,
): Promise<boolean> {
  const session = await getToken(password);
  if (!session) {
    console.warn("[novastar] login failed on all hosts");
    return false;
  }

  try {
    const res = await fetch(`http://${session.host}:${PORT}/api/v1/brightness`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ brightness }),
    });
    const data = await res.json() as { errCode?: number; errMsg?: string };
    if (data.errCode === 0) {
      console.log(`[novastar] brightness ${brightness}% applied via ${session.host}`);
      return true;
    }
    // Token may have expired — clear cache so next call re-authenticates
    if (data.errCode === 401 || data.errCode === 403) {
      tokenCache = null;
    }
    console.warn("[novastar] brightness error:", data);
    return false;
  } catch (e) {
    console.warn("[novastar] PUT failed:", e);
    tokenCache = null;
    return false;
  }
}
