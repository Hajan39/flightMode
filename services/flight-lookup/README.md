# Flight lookup Worker

Optional "fill in my flight by flight number" for the FlightMode flight editor.
A tiny Cloudflare Worker that proxies **AeroDataBox** schedule data (via
API.Market) with a KV cache. The app never talks to AeroDataBox directly and
never holds the API key.

```
App ──GET /v1/flight?number=OK766&date=2026-11-14──▶ Worker ──(cache miss)──▶ AeroDataBox
                                                       │
                                                       └─ KV cache  v1:OK766:2026-11-14
```

**Status: off in production.** The app only shows the "Fill in" button when the
build sets `EXPO_PUBLIC_FLIGHT_LOOKUP_URL`. Keep it out of production builds
until the AeroDataBox subscription is a paid commercial plan (see step 7).

---

## API

`GET /v1/flight?number=OK766&date=2026-11-14`

| Status | Body |
|---|---|
| 200 | `{ number, date, departure, arrival, durationMinutes, codeshareStatus, codeshares?, legCount, airline? }` |
| 400 | `{ "error": "invalid_number" }` / `{ "error": "invalid_date" }` |
| 404 | `{ "error": "not_found" }` |
| 429 | `{ "error": "rate_limited" }` (per client) |
| 503 | `{ "error": "upstream_unavailable" }` (provider down, key missing/invalid, provider quota, or our daily cap) |

`departure` / `arrival`: `{ iata?, icao?, name?, city?, timeZone?, scheduledLocal, scheduledUtc }`.
`scheduledUtc` is ISO 8601 UTC; `scheduledLocal` is the airport wall time with
offset (`2026-11-14T09:00+01:00`). Schedule data only — no live status.

Input rules (rejected **without** calling the provider):

- Flight number: uppercase, spaces/dashes removed; airline IATA (2 chars, at
  least one letter) or ICAO (3 letters) + 1–4 digits + optional letter.
- Date: `YYYY-MM-DD`, a real date, within today − 1 … today + 330 days (UTC),
  configurable via `MAX_DAYS_BEHIND` / `MAX_DAYS_AHEAD`.

Leg choice: the provider returns every flight with that number departing *or
arriving* on the date. The Worker takes legs whose scheduled **departure**
local date equals the requested date, then the earliest (first leg of a
multi-leg flight; `legCount` tells how many legs fly that day). Entries for the
same physical leg under other numbers are returned as `codeshares`.

## Cost and abuse protection

Order per request: validate → per-client rate limit → KV read → daily budget →
provider → KV write.

- **KV cache** `v1:{NUMBER}:{DATE}`: found flights until the end of the day
  after the flight, capped by `CACHE_MAX_SECONDS` (default 3 days, so schedule
  changes for far-future flights are picked up); "not found" for
  `NEGATIVE_CACHE_SECONDS` (default 6 h). KV is written **only** on a definitive
  provider answer (found / not found) — the free plan allows 1,000 KV writes a
  day, so keep `UPSTREAM_DAILY_CAP` below that.
- **Per-client rate limit**: Workers Rate Limiting binding `IP_RATE_LIMITER`
  (10 requests / 60 s per client, keyed by a SHA-256 hash of the IP — the IP
  itself is never stored). It is counted per Cloudflare location and is
  eventually consistent, which is fine for abuse protection. Without the
  binding, a per-isolate in-memory limiter (`IP_LIMIT_PER_MINUTE`) is used —
  best effort only.
- **Global daily cap** `UPSTREAM_DAILY_CAP` (default 100 provider calls per UTC
  day): a single SQLite-backed Durable Object counts calls. It is only hit on a
  cache miss and costs no KV writes. Trade-offs considered: a KV counter would
  burn a write per call (and is eventually consistent); the Cache API is per
  data centre, so it would not be a global cap. If the Durable Object binding
  is removed, a per-isolate counter is used (not a real global cap).
- If the budget store is unreachable the Worker fails closed (503) — the app
  just shows "fill in yourself".

## Privacy

- Sent by the app: the flight number and date, only when the user taps
  **Fill in**. The Worker sees the client IP (as any web server does) and uses
  it only, hashed, for the rate limit.
- No logging: the code never calls `console.*`, and Workers Logs are disabled
  (`[observability] enabled = false`). Leave them off in the dashboard too.
  Cloudflare's own aggregate request metrics remain.
- Stored: only the flight data in KV (no user identifier).
- Sent to AeroDataBox: flight number + date + our API key. Not the user's IP.

---

## Owner setup (works from a phone browser)

### 1. AeroDataBox on API.Market

1. Sign up at <https://api.market> and open the AeroDataBox listing
   (`api.market/store/aedbx/aerodatabox`).
2. Subscribe to the **free / trial plan** for development. The endpoint used
   (`GET /flights/number/{number}/{date}`, "Flight status") is a **TIER 2**
   endpoint — check how many units/calls the plan includes and set
   `UPSTREAM_DAILY_CAP` well below it.
3. Copy your API key (API.Market dashboard → API keys). Do not paste it into
   chat, issues or code.
4. Read the AeroDataBox Terms of Use (caching / storage of data and commercial
   use; article 5 at the time of writing) and adjust `CACHE_MAX_SECONDS` if they
   require a shorter cache.

### 2. Cloudflare account + KV namespace

1. Sign up at <https://dash.cloudflare.com> (Workers **Free** plan is enough).
2. **Storage & Databases → KV → Create** a namespace named
   `flightmode-flight-cache`.
3. Copy its **ID** (32 hex characters). Either
   - GitHub → repo **Settings → Secrets and variables → Actions → Variables →
     New repository variable**: `FLIGHT_LOOKUP_KV_ID` = the ID (the deploy
     workflow fills it in), or
   - edit `services/flight-lookup/wrangler.toml` on GitHub and replace
     `REPLACE_WITH_KV_NAMESPACE_ID`.

### 3. Cloudflare API token for GitHub Actions

1. Cloudflare dashboard → **My Profile → API Tokens → Create Token** →
   template **"Edit Cloudflare Workers"**. Limit it to your account.
2. Note your **Account ID** (Workers & Pages overview, right-hand side).
3. GitHub → repo **Settings → Secrets and variables → Actions → Secrets →
   New repository secret**:
   - `CLOUDFLARE_API_TOKEN` = the token
   - `CLOUDFLARE_ACCOUNT_ID` = the account ID

Until these exist, `.github/workflows/deploy-flight-lookup.yml` type-checks and
skips the deploy with a notice (it does not fail).

### 4. First deploy

GitHub → **Actions → Deploy Flight Lookup Worker → Run workflow** (or push a
change under `services/flight-lookup/` to `main`). It creates the Worker
`flightmode-flight-lookup` with the KV, rate-limit and Durable Object bindings.

### 5. Add the AeroDataBox key as a Worker secret

Cloudflare dashboard → **Workers & Pages → flightmode-flight-lookup →
Settings → Variables and Secrets → Add** → type **Secret**, name
`AERODATABOX_API_KEY`, value = the API.Market key → **Deploy**.
(From a computer: `cd services/flight-lookup && npx wrangler secret put AERODATABOX_API_KEY`.)

Without the secret the Worker answers 503 and never calls the provider.

Check: open
`https://flightmode-flight-lookup.<your-subdomain>.workers.dev/v1/flight?number=OK766&date=<a date in the next days>`
in the browser — you should get JSON (or `{"error":"not_found"}`).

### 6. Enable the button in preview / internal builds only

The app reads `EXPO_PUBLIC_FLIGHT_LOOKUP_URL` (the Worker origin, no path) at
build time. Set it for **preview / development** only:

- expo.dev → project → **Environment variables → Add** →
  name `EXPO_PUBLIC_FLIGHT_LOOKUP_URL`, value
  `https://flightmode-flight-lookup.<your-subdomain>.workers.dev`,
  environments **preview** (and **development**), visibility *Plain text*
  (it is not a secret — it ships inside the app). Do **not** tick production.
- or, from a computer, add it to the `preview` profile's `env` in `eas.json`
  (note: an `eas.json` change on `main` triggers a native build).

Then `npm run deploy:internal` (or an EAS preview build). Locally:
`EXPO_PUBLIC_FLIGHT_LOOKUP_URL=https://… npm run start`.
`npm run ota:preview` also bakes the variable into the update if it is set in
your shell / EAS environment.

### 7. Going to production (later)

1. On API.Market, switch AeroDataBox to a **paid plan that allows commercial
   use**; raise `UPSTREAM_DAILY_CAP` in `wrangler.toml` to fit its quota (and
   mind the KV write limit — upgrade to Workers Paid if you need more than
   ~1,000 new cache entries a day).
2. Add `EXPO_PUBLIC_FLIGHT_LOOKUP_URL` to the **production** EAS environment.
3. Ship an app build / OTA. The privacy policy section "Flight lookup
   (optional)" is already published.

## Switching provider marketplace (no code change)

`wrangler.toml` `[vars]`:

| | API.Market (default) | RapidAPI |
|---|---|---|
| `UPSTREAM_BASE_URL` | `https://prod.api.market/api/v1/aedbx/aerodatabox` | `https://aerodatabox.p.rapidapi.com` |
| `UPSTREAM_AUTH_HEADER` | `x-api-market-key` | `X-RapidAPI-Key` |
| `UPSTREAM_HOST_HEADER` | *(empty)* | `X-RapidAPI-Host` |

`UPSTREAM_DATE_ROLE` (default `Departure`) is sent as `dateLocalRole`; set it
to empty if the provider rejects the parameter.

## Not verified (no network access to the provider docs when this was built)

The endpoint path, response models (`FlightContract`, `scheduledTime.utc/local`,
`codeshareStatus`) and the RapidAPI base URL/headers come from the published
AeroDataBox OpenAPI client. **Not verified** and worth checking on the first
real call:

- API.Market base URL `https://prod.api.market/api/v1/aedbx/aerodatabox` and
  header `x-api-market-key` (both configurable).
- `dateLocalRole` query parameter support (configurable / can be disabled).
- "No flight" answer: handled as 204, 404 and 400.
- Time string format (`2026-11-14 08:00Z` / `2026-11-14 09:00+01:00`); ISO
  variants and the older flat `scheduledTimeUtc` fields are accepted too.
- Date range the provider accepts (Worker default: −1 … +330 days).
- Plan pricing/units and the Terms of Use caching clause (article 5).
- Workers Rate Limiting binding and SQLite Durable Objects on the Free plan
  (both bindings are optional; the Worker falls back if they are removed).

Re-record `__tests__/helpers/aerodataboxFixtures.ts` from a real response once
the account exists.

## Development

```bash
cd services/flight-lookup
npm ci                # own lockfile; the root package-lock.json is untouched
npm run typecheck     # tsc with @cloudflare/workers-types
npm run dry-run       # wrangler bundle + config check, no account needed
npx wrangler dev      # local run; put AERODATABOX_API_KEY=… in .dev.vars (git-ignored)
```

Logic lives in `src/core.ts` (pure, no Cloudflare types) and is tested from the
app's root Jest run: `npm test -- flightLookupWorker` in the repo root.
`src/index.ts` only wires bindings.
