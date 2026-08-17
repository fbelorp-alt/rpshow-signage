---
name: Device self-registration flow
description: How devices register, auto-pairing, and the definitive fix for "sem dono" records
---

# Device Self-Registration Flow

## Rule: NEVER auto-create device records on check

The `GET /api/devices/check/:serial` endpoint must NEVER auto-insert records into the DB.
When an unknown serial arrives, return `{ status: "unregistered", approved: false }` and stop.

**Why:** Auto-creation always produced "sem dono" (userId=null) records that operators couldn't see,
causing duplicates and confusion. The only correct path is operator-first registration.

## Correct flow (post-fix)

1. Device boots → polls `/api/devices/check/:serial` → gets `{ status: "unregistered" }`
2. Player screen shows the FULL serial (no slice) so operator can read and register it
3. Operator goes to dashboard → Cadastrar Dispositivo → types exact serial → device created as `approved` with their userId
4. Device polls again → suffix match or exact match finds the record → approved → navigates to player

## Serial matching

`resolveApprovedDevice(serial)` does:
1. Exact match on `devices.serial`
2. Suffix match: `serial LIKE '%' || devices.serial` — so operator can register last-8 chars and APK full serial still matches

This means operators don't HAVE to type the full 16-char serial — suffix matching handles it.

## Operator POST /devices creates as approved

When an operator (not admin) registers a device:
- `status = 'approved'` immediately (no pending step)
- `userId = operator's userId`
- Screen is created automatically in the check endpoint on next poll

## Admin PATCH /devices supports reassignment

`PATCH /devices/:id` with `assignedUserId` in body lets admin reassign a device to any operator.
Previously `assignedUserId` was only handled in POST.

## Self-update endpoint

`POST /api/admin/self-update` (admin-only) runs:
```
cd /var/www/rpshow && git fetch origin && git reset --hard origin/main && pm2 restart rpshow-api
```
Dashboard admin panel has a "Deploy VPS" button that calls this.
This requires the compiled `dist/index.mjs` to be committed to git (exception in .gitignore).

## VPS deploy notes

- `dist/index.mjs` is committed to git (exception: `!artifacts/api-server/dist/index.mjs` in .gitignore)
- GitHub Actions workflow `deploy-vps.yml` fails without `VPS_HOST`/`VPS_USER`/`VPS_PASSWORD` secrets
- As workaround: "Deploy VPS" button in admin panel calls the self-update endpoint directly
- The self-update endpoint only works after the FIRST manual VPS update
