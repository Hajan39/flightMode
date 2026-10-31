/**
 * FlightMode flight-lookup Worker: GET /v1/flight?number=OK123&date=2026-11-14
 *
 * Thin Cloudflare wiring around `core.ts` (pure logic, unit-tested from the
 * app's root Jest run). Proxies AeroDataBox schedule data with a KV cache.
 *
 * Privacy: no console logging, Workers Logs disabled in wrangler.toml, the
 * client IP is only used — hashed — as a rate-limit key and never stored.
 */
import { DurableObject } from "cloudflare:workers";

import {
  type BudgetState,
  FixedWindowLimiter,
  handleLookup,
  type LookupConfig,
  type LookupResponse,
  parseConfig,
  takeBudget,
} from "./core";

export interface Env {
  /** Secret (dashboard or `wrangler secret put`), never in wrangler.toml. */
  AERODATABOX_API_KEY?: string;
  FLIGHT_CACHE: KVNamespace;
  /** Workers Rate Limiting binding (optional; in-memory fallback). */
  IP_RATE_LIMITER?: RateLimit;
  /** Global daily upstream counter (optional; per-isolate fallback). */
  UPSTREAM_BUDGET?: DurableObjectNamespace<UpstreamBudget>;
  [key: string]: unknown;
}

const BUDGET_KEY = "budget";

/**
 * One global instance counts upstream calls per UTC day. SQLite-backed
 * Durable Objects are on the Workers Free plan; it is only hit on a KV miss,
 * so it costs one DO request per upstream call and no KV writes.
 */
export class UpstreamBudget extends DurableObject {
  async take(cap: number): Promise<boolean> {
    const state = await this.ctx.storage.get<BudgetState>(BUDGET_KEY);
    const next = takeBudget(state, Date.now(), cap);
    if (next.allowed) {
      await this.ctx.storage.put(BUDGET_KEY, next.state);
    }
    return next.allowed;
  }
}

// Best-effort fallbacks, per isolate (see README "Abuse protection").
let memoryLimiter: FixedWindowLimiter | null = null;
let memoryBudget: BudgetState | null = null;

async function hashKey(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`flightmode-rl:${value}`)
  );
  return [...new Uint8Array(digest).slice(0, 16)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function json(response: LookupResponse) {
  return new Response(JSON.stringify(response.body), {
    headers: {
      "Cache-Control":
        response.maxAge > 0
          ? `private, max-age=${response.maxAge}`
          : "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
    status: response.status,
  });
}

function plainError(status: number, error: string, extra?: HeadersInit) {
  return new Response(JSON.stringify({ error }), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...extra,
    },
    status,
  });
}

async function fetchWithTimeout(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number
) {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });
  return {
    json: () => response.json() as Promise<unknown>,
    status: response.status,
  };
}

function makeDeps(request: Request, env: Env, config: LookupConfig) {
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  return {
    apiKey: env.AERODATABOX_API_KEY,
    cacheGet: (key: string) => env.FLIGHT_CACHE.get(key),
    cachePut: (key: string, value: string, ttlSeconds: number) =>
      env.FLIGHT_CACHE.put(key, value, { expirationTtl: ttlSeconds }),
    fetchUpstream: (url: string, headers: Record<string, string>) =>
      fetchWithTimeout(url, headers, config.upstreamTimeoutMs),
    now: () => Date.now(),
    rateLimit: async () => {
      const key = await hashKey(ip);
      if (env.IP_RATE_LIMITER) {
        const { success } = await env.IP_RATE_LIMITER.limit({ key });
        return success;
      }
      memoryLimiter ??= new FixedWindowLimiter(config.ipLimitPerMinute);
      return memoryLimiter.check(key, Date.now());
    },
    takeUpstreamBudget: async () => {
      if (env.UPSTREAM_BUDGET) {
        try {
          const stub = env.UPSTREAM_BUDGET.get(
            env.UPSTREAM_BUDGET.idFromName("global")
          );
          return await stub.take(config.upstreamDailyCap);
        } catch {
          // Budget store unreachable: fail closed, quota is what it protects.
          return false;
        }
      }
      const next = takeBudget(
        memoryBudget,
        Date.now(),
        config.upstreamDailyCap
      );
      memoryBudget = next.state;
      return next.allowed;
    },
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/v1/flight") {
      return plainError(404, "unknown_route");
    }
    if (request.method !== "GET") {
      return plainError(405, "method_not_allowed", { Allow: "GET" });
    }
    const config = parseConfig(env);
    try {
      const result = await handleLookup(
        url.searchParams.get("number"),
        url.searchParams.get("date"),
        makeDeps(request, env, config),
        config
      );
      return json(result);
    } catch {
      return plainError(503, "upstream_unavailable");
    }
  },
} satisfies ExportedHandler<Env>;
