---
name: Device self-registration flow
description: How devices self-register/approve and how missing screens self-heal
---

# Device self-registration flow

- Operators register their own devices (status starts `pending`); admin approves via `/admin`.
- `POST /api/devices` upserts records that the APK auto-created via its check-in call.
- Operators are blocked from changing device `status` themselves; only admin can approve/reject.
- `/devices` page is dual-role: operators see their own devices, admins see all.

## Self-healing: approved device with no screen row
`GET /api/devices/check/:serial` (no auth, called periodically by the APK) is also responsible
for lazily creating the `screens` row for any approved device that doesn't have one yet, keyed by
`screenCode`. If a device shows `approved` in `devices` but has no matching row in `screens`
(e.g. it was approved through a path that skipped this step, or the TV hasn't polled since),
you don't need a manual DB write — just call this endpoint against production with the device's
`serial`:

```bash
curl -s "https://<prod-domain>/api/devices/check/<SERIAL>"
```

**Why:** This is the same code path the TV box itself calls on every check-in, so replaying it is
safe and idempotent, and avoids needing a direct write to the read-only-enforced production DB.
**How to apply:** When you spot an approved device with a missing screen (compare `devices.screen_code`
against `screens.code` in a read-only prod query), get the device's `serial` and curl the check
endpoint on the production domain instead of writing a one-off admin/DB fix.
