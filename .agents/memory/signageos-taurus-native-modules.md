---
name: Taurus Android — native module incompatibility
description: expo-brightness and expo-network crash the player on NovaStar Taurus custom Android; never add native Expo modules that aren't already proven working on Taurus
---

## Rule
Never add `expo-brightness`, `expo-network`, or other native Expo modules to the player APK unless confirmed working on NovaStar Taurus custom Android.

**Why:** Taurus devices run a custom Android build. Native Expo modules that require system APIs (WRITE_SETTINGS for brightness, network info APIs) fail during module initialization — BEFORE any JS runs — causing an immediate crash loop: app flickers and goes black, shows "Not running" in ViPlex Express.

**How to apply:**
- Brightness control → use NovaStar HTTP API on port 7788 (loopback `127.0.0.1` — player runs ON the Taurus device). No native module needed.
- Network info → not needed; `127.0.0.1` always works for on-device APIs.
- If a native module is required for a feature, test on a physical Taurus device first before shipping.
- `toLocaleTimeString` with `timeZone` option may also throw on Hermes/Android — always wrap in try/catch with manual fallback (pad hours/minutes/seconds manually).
