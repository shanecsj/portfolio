import { toCuisineGroups } from "./cuisine";
import { haversineMeters } from "./distance";
import type { Place } from "./types";
import { USER_AGENT } from "./user-agent";

/**
 * Nearby-food provider backed by OpenStreetMap through the Overpass API.
 *
 * Picked for the prototype because it needs no API key and no billing account,
 * so /eatwhat works on a fresh clone and on a Vercel preview with nothing
 * configured. Moving to Google Places later means rewriting this file only —
 * the route handler and the UI both speak `Place`.
 *
 * Known limits: the public Overpass instances are rate-limited and sometimes
 * slow, and OSM data is crowd-sourced, so a place that shut last month can
 * still be listed and opening hours are usually missing entirely.
 */

/**
 * Public instances, tried in order. All free and keyless.
 *
 * `lz4.` and `z.` are the project's own alternate front ends. They are not
 * fully independent of the main host, but they do land on different backends,
 * and in practice they answer in about a second while the main one is queuing.
 *
 * Deliberately not listed: overpass.osm.ch answers quickly and with a cheerful
 * 200, but holds Swiss data only — measured against a Singapore query it
 * returns zero elements, which would read as "nothing nearby" rather than as a
 * failure to fall through. overpass.kumi.systems used to sit here and was
 * removed: it is now a CNAME to overpass.private.coffee, which accepts the TCP
 * connection and then never answers, so it only ever added a full timeout to
 * the failure path.
 */
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
];

/**
 * Patience for the first endpoint.
 *
 * The rate limit is two slots per IP, and passing it makes Overpass *queue* the
 * request rather than refuse it — so a slow answer is usually an answer on its
 * way, not a dead connection. This was 8s, which measured 9.2s on a queued
 * request that then succeeded: the old timeout was throwing away results it had
 * already waited most of the way for.
 */
const PRIMARY_TIMEOUT_MS = 12_000;

/**
 * Tighter, because reaching a fallback already means time is short. Worst case
 * 12 + 7 + 7 = 26s, inside the route's 30s `maxDuration` with room for the
 * handler either side.
 */
const FALLBACK_TIMEOUT_MS = 7_000;

/**
 * Repeat lookups are common — the same origin re-queried after a radius change,
 * or several people searching the same mall at lunchtime — and every one of
 * them spends a rate-limit slot that then is not there for someone else. OSM
 * data moves far more slowly than this window, so serving a recent answer costs
 * nothing in freshness.
 */
const CACHE_TTL_MS = 30 * 60_000;

/** Bounded so a long-lived instance cannot grow one entry per visitor. */
const CACHE_MAX_ENTRIES = 200;

/**
 * Coordinate precision for the cache key: 4 decimal places is about 11 m, far
 * inside the smallest 500 m radius, so two searches that round together are
 * asking the same question. Distances are recomputed from the caller's real
 * position on a hit, so the rounding never reaches the visitor.
 */
const CACHE_PRECISION = 4;

/**
 * Waits before re-asking the primary after a 429.
 *
 * A 429 means both of this IP's slots are in use *right now*, and it comes back
 * in well under a second — so the cheapest thing to do is wait and ask again.
 * Falling through to the other endpoints instead is what the code used to do
 * and it cannot work: they are the same project behind the same per-IP limit,
 * and measured after a 429 they simply time out, costing 14s to learn nothing.
 */
const RATE_LIMIT_BACKOFFS_MS = [2_000, 4_000];

/**
 * Statuses that mean "ask again shortly" rather than "this is broken". 429 is
 * the per-IP slot limit; 503 and 504 are the instance shedding load or its own
 * gateway giving up. None of them says anything about the query itself.
 */
const BUSY_STATUSES = new Set([429, 503, 504]);

/**
 * Ceiling on the whole lookup, retries and backoffs included, kept under the
 * route's 30s `maxDuration` so the function returns a real error rather than
 * being killed mid-flight. Every attempt is clipped to what is left of it.
 */
const TOTAL_BUDGET_MS = 25_000;

/** Below this there is not enough time left for an attempt to be worth making. */
const MIN_ATTEMPT_MS = 1_500;

/**
 * Enough to randomise over without pulling a whole city centre. Overpass
 * applies the cap in its own order, not by distance, so a dense area gets an
 * arbitrary 80 of what's around — fine for a randomiser, not for "the nearest".
 */
const MAX_RESULTS = 80;

/**
 * OSM `amenity` values we count as "somewhere you can eat". Deliberately not
 * `shop=bakery` and friends — those live under a different key and would need
 * a second clause in the query.
 */
const AMENITIES = [
  "restaurant",
  "cafe",
  "fast_food",
  "food_court",
  "bar",
  "pub",
  "ice_cream",
];

type OverpassElement = {
  type: string;
  id: number;
  /** Present on nodes. Ways and relations carry `center` instead. */
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/**
 * `nwr` covers nodes, ways and relations — a mall food court is usually a way,
 * not a point. `[name]` drops unnamed entries server-side; "a random unnamed
 * restaurant" is no use to anyone. `out center` collapses each way/relation to
 * a single coordinate.
 */
function buildQuery(lat: number, lon: number, radiusMeters: number): string {
  const amenities = AMENITIES.join("|");
  return [
    "[out:json][timeout:20];",
    `nwr[amenity~"^(${amenities})$"][name](around:${radiusMeters},${lat},${lon});`,
    `out center ${MAX_RESULTS};`,
  ].join("\n");
}

/** "fast_food" -> "Fast food". */
function humanise(value: string): string {
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function toPlace(
  element: OverpassElement,
  centerLat: number,
  centerLon: number,
): Place | null {
  const name = element.tags?.name;
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (!name || lat === undefined || lon === undefined) return null;

  return {
    id: `${element.type}/${element.id}`,
    name,
    category: humanise(element.tags?.amenity ?? "place"),
    // The cuisine tag is a semicolon-separated list, e.g. "chinese;noodle".
    cuisines:
      element.tags?.cuisine
        ?.split(";")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map(humanise) ?? [],
    cuisineGroups: toCuisineGroups(element.tags?.cuisine),
    lat,
    lon,
    distanceMeters: haversineMeters(centerLat, centerLon, lat, lon),
  };
}

async function postWithTimeout(
  endpoint: string,
  query: string,
  timeoutMs: number,
) {
  // AbortSignal.timeout would be tidier but isn't in this project's TS DOM lib.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // Overpass answers 406 to any request without one, and its usage
        // policy asks that the agent identify who to contact about traffic.
        "User-Agent": USER_AGENT,
      },
      body: new URLSearchParams({ data: query }),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    // An abort surfaces as an opaque "fetch failed" once it crosses Next's
    // patched fetch. Relabel it so the server log says which failure it was.
    throw timedOut
      ? new Error(`${endpoint} did not answer within ${timeoutMs}ms`)
      : error;
  } finally {
    clearTimeout(timer);
  }
}

type CacheEntry = { places: Place[]; storedAt: number };

/**
 * Module scope, so a warm serverless instance answers repeats without touching
 * Overpass. Deliberately not a shared store: this is an optimisation, and a
 * cold instance simply paying the lookup again is a correct outcome.
 */
const cache = new Map<string, CacheEntry>();

function cacheKey(lat: number, lon: number, radiusMeters: number): string {
  return `${lat.toFixed(CACHE_PRECISION)},${lon.toFixed(CACHE_PRECISION)},${radiusMeters}`;
}

/**
 * Cached places re-measured from where the caller actually is.
 *
 * The key rounds the centre, so a hit may have been stored for a point up to
 * ~11 m away and its distances would be wrong by that much. Each place carries
 * its own coordinates, so recomputing is exact rather than approximate.
 */
function remeasure(places: Place[], lat: number, lon: number): Place[] {
  return places
    .map((place) => ({
      ...place,
      distanceMeters: haversineMeters(lat, lon, place.lat, place.lon),
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

function readCache(key: string): Place[] | null {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.storedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  // Refresh insertion order so eviction below drops the least recently used
  // rather than merely the oldest.
  cache.delete(key);
  cache.set(key, entry);
  return entry.places;
}

function writeCache(key: string, places: Place[]): void {
  cache.set(key, { places, storedAt: Date.now() });

  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
}

/**
 * Places within `radiusMeters` of the given point, nearest first.
 * Throws only if every endpoint fails — the route handler turns that into a
 * 502. The thrown message names what each one did, because a single "last
 * error" hid the primary's failure behind whichever fallback spoke last.
 */
export async function fetchNearbyPlaces(
  lat: number,
  lon: number,
  radiusMeters: number,
): Promise<Place[]> {
  const key = cacheKey(lat, lon, radiusMeters);
  const cached = readCache(key);
  if (cached) return remeasure(cached, lat, lon);

  const query = buildQuery(lat, lon, radiusMeters);
  const failures: string[] = [];
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const remaining = () => deadline - Date.now();

  /**
   * One request. Returns the places, "busy" if it is worth waiting and asking
   * again, or null if this endpoint is simply no good right now. Skips itself
   * when too little of the budget is left to finish.
   */
  const attempt = async (
    endpoint: string,
    timeoutMs: number,
  ): Promise<Place[] | "busy" | null> => {
    const budget = Math.min(timeoutMs, remaining());
    if (budget < MIN_ATTEMPT_MS) {
      // Recorded rather than returned silently: without this the thrown error
      // reads as though nothing was tried at all.
      failures.push(`${endpoint} skipped, ${remaining()}ms of budget left`);
      return null;
    }

    try {
      const response = await postWithTimeout(endpoint, query, budget);
      if (!response.ok) {
        failures.push(`${endpoint} responded ${response.status}`);
        return BUSY_STATUSES.has(response.status) ? "busy" : null;
      }

      const body = (await response.json()) as { elements?: OverpassElement[] };
      return (body.elements ?? [])
        .map((element) => toPlace(element, lat, lon))
        .filter((place): place is Place => place !== null)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);
    } catch (error) {
      failures.push(String(error));
      return null;
    }
  };

  const [primary, ...fallbacks] = ENDPOINTS;
  let result = await attempt(primary, PRIMARY_TIMEOUT_MS);

  // A slow or broken primary may just be one unhappy backend, so the sibling
  // front ends are worth a try. A "busy" answer is a per-IP verdict all three
  // share, so skip straight to waiting it out instead.
  if (result === null) {
    for (const endpoint of fallbacks) {
      result = await attempt(endpoint, FALLBACK_TIMEOUT_MS);
      if (result !== null) break;
    }
  }

  for (const backoff of RATE_LIMIT_BACKOFFS_MS) {
    if (result !== "busy") break;
    if (remaining() < backoff + MIN_ATTEMPT_MS) break;
    await new Promise((resolve) => setTimeout(resolve, backoff));
    result = await attempt(primary, PRIMARY_TIMEOUT_MS);
  }

  if (Array.isArray(result)) {
    writeCache(key, result);
    return result;
  }

  throw new Error(`All Overpass endpoints failed. ${failures.join("; ")}`);
}
