/**
 * NovaStar Taurus local HTTP API — APK installation
 *
 * The Taurus device exposes a REST API on port 7788.
 * Flow: POST /api/v1/login → token → POST /api/v1/appMgr/install
 * This tells the Taurus firmware to download and install the APK silently.
 */

const PORT = 7788;
const DEFAULT_USER = "admin";
const DEFAULT_PASS = "123456";

async function login(): Promise<{ host: string; token: string } | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/v1/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userName: DEFAULT_USER, password: DEFAULT_PASS }),
    });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const token =
      (data?.token as string | undefined) ??
      ((data?.data as Record<string, unknown>)?.token as string | undefined);
    return token ? { host: "127.0.0.1", token } : null;
  } catch {
    return null;
  }
}

/**
 * Ask the NovaStar Taurus firmware to download and install an APK.
 * Tries the v1 appMgr endpoint; falls back to system/app endpoint.
 * @param apkUrl  Public URL of the APK to install
 * @param password  NovaStar admin password (default "123456")
 * @returns true if the command was accepted, false otherwise
 */
export async function novastarInstallApk(
  apkUrl: string,
  password = DEFAULT_PASS,
): Promise<boolean> {
  const session = await login();
  if (!session) {
    console.warn("[novastar-install] login failed — cannot push APK");
    return false;
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.token}`,
  };

  // Primary endpoint (Taurus T-series v1 API)
  const endpoints = [
    { path: "/api/v1/appMgr/install",        body: { apkPath: apkUrl } },
    { path: "/api/v1/system/app/install",     body: { apkPath: apkUrl } },
    { path: "/api/v2/appPkg/install",         body: { appPkgPath: apkUrl, isUpgrade: true } },
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`http://${session.host}:${PORT}${ep.path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(ep.body),
      });
      const data = await res.json() as { errCode?: number; errMsg?: string };
      if (data.errCode === 0 || res.ok) {
        console.log(`[novastar-install] APK install triggered via ${ep.path}:`, apkUrl);
        return true;
      }
      console.warn(`[novastar-install] ${ep.path} errCode=${data.errCode} msg=${data.errMsg}`);
    } catch (e) {
      console.warn(`[novastar-install] ${ep.path} failed:`, e);
    }
  }

  return false;
}
