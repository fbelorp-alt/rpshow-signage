---
name: SignageOS play tracking
description: Play event logging, reports page, new widget types (clock/weather/rss), dashboard playsToday card
---

## What was built

- `lib/db/src/schema/media-plays.ts` — `media_plays` table (screenId, screenCode, screenName, mediaId, mediaName, mediaType, durationSeconds, playedAt). Already pushed to prod DB.
- `artifacts/api-server/src/routes/reports.ts` — `GET /api/reports/plays` + `GET /api/reports/summary` (playsToday/week/month/total, topMedia, playsByDay last 7 days). Registered in routes/index.ts.
- `artifacts/api-server/src/routes/player.ts` — added `POST /:screenCode/play` to log each media play; returns `metaJson` in playlist response.
- `artifacts/api-server/src/routes/dashboard.ts` — added `playsToday` to `/stats` response.
- `artifacts/signage-dashboard/src/pages/reports.tsx` — NEW reports page at `/reports` with stat cards, recharts bar chart (last 7 days), top 10 media, history table.
- `artifacts/signage-dashboard/src/pages/dashboard.tsx` — 4-column stats grid with new "Exibições Hoje" card.
- `artifacts/signage-dashboard/src/pages/media.tsx` — added Clock, Weather, RSS widget creation dialogs and sidebar filters.
- `artifacts/player-app/app/player/[code].tsx` — added ClockWidget, WeatherWidget (Open-Meteo free API), RssTicker (animated Animated.Value scroll), play event logging via direct fetch to `/api/player/:code/play`.

## Widget conventions

- `clock` type: url = "clock://local", player renders ClockWidget (setInterval 1s)
- `weather` type: url = city name (e.g. "São Paulo"), player fetches Open-Meteo geocoding then forecast
- `rss` type: url = feed URL, player renders RssTicker overlay at bottom of ALL playlists that include an rss item. Duration 0 = always-on overlay.

## Open-Meteo endpoints (no API key needed)

- Geocoding: `https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1&language=pt&format=json`
- Forecast: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true&timezone=auto`

**Why:** Free, no key, reliable for Brazilian cities.

## Pre-existing TS errors (do not fix unless asked)

- `src/lib/objectStorage.ts:265` — `Property 'signed_url' does not exist on type 'unknown'`
- `src/routes/clients.ts:41,61,71` — Not all code paths return a value
These are pre-existing and not blocking runtime.
