/**
 * In-memory store for pending APK installs.
 * Admin triggers via dashboard → stored here → delivered on next player heartbeat → cleared.
 * No DB column needed — ephemeral state only.
 */

const pendingMap = new Map<number, string>(); // screenId → apkUrl

export function setPendingApk(screenId: number, apkUrl: string): void {
  pendingMap.set(screenId, apkUrl);
}

export function consumePendingApk(screenId: number): string | undefined {
  const url = pendingMap.get(screenId);
  if (url !== undefined) pendingMap.delete(screenId);
  return url;
}
