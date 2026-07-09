/**
 * Lightweight production build for Expo player-app.
 *
 * The full Metro bundle build (iOS + Android) is NOT used in production because
 * expo-updates is not installed in the APK — the APK is self-contained and built
 * separately via EAS (GitHub Actions). Running Metro during Replit deployment
 * caused 10+ minute timeouts and deployment failures.
 *
 * This script only sets up the static-build directory structure so the serve
 * script starts cleanly. The serve script already handles missing manifests
 * gracefully (returns 404).
 */

const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const staticBuild = path.join(projectRoot, "static-build");

console.log("Setting up player-app static-build directory...");

const dirs = [
  path.join(staticBuild, "ios"),
  path.join(staticBuild, "android"),
];

for (const dir of dirs) {
  fs.mkdirSync(dir, { recursive: true });
}

console.log("player-app build complete (lightweight mode).");
process.exit(0);
