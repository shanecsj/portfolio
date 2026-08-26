import type { Place } from "./types";

/**
 * Nearby-food provider backed by OpenStreetMap through the Overpass API.
 *
 * Picked for the prototype because it needs no API key and no billing account,
 * so /eatwhere works on a fresh clone and on a Vercel preview with nothing
 * configured. Moving to Google Places later means rewriting this file only —
 * the route handler and the UI both speak `Place`.
 *
 * Known limits: the public Overpass instances are rate-limited and sometimes
 * slow, and OSM data is crowd-sourced, so a place that shut last month can
 * still be listed and opening hours are usually missing entirely.
 */

/**
 * Public instances, tried in order. Both are free and keyless.
 *
 * The main instance rate-limits per IP: fire several searches back to back and
 * it parks the request until a slot frees, which is what the timeout below is
 * really guarding against. Regional mirrors are deliberately not listed —
 * overpass.osm.ch answers fine but only holds Swiss data, so it would return a
 * confident empty list everywhere else.
 */
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/** Required — see the header comment in `postWithTimeout`. */
const USER_AGENT = "shanecsj.dev/eatwhere (https://shanecsj.dev)";

/**
 * Per-endpoint budget. A warm query answers in about a second; anything past
 * this means the instance is queueing us, so cut it loose and try the next.
 * Two endpoints at 8s each stays inside the route's `maxDuration`.
 */
const TIMEOUT_MS = 8_000;

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

/** Metres between two coordinates, great-circle. */
function haversineMeters(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): number {
  const EARTH_RADIUS_M = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(toLat - fromLat);
  const dLon = toRad(toLon - fromLon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
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
    lat,
    lon,
    distanceMeters: haversineMeters(centerLat, centerLon, lat, lon),
  };
}

async function postWithTimeout(endpoint: string, query: string) {
  // AbortSignal.timeout would be tidier but isn't in this project's TS DOM lib.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);
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
      ? new Error(`${endpoint} did not answer within ${TIMEOUT_MS}ms`)
      : error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Places within `radiusMeters` of the given point, nearest first.
 * Throws if every endpoint fails — the route handler turns that into a 502.
 */
export async function fetchNearbyPlaces(
  lat: number,
  lon: number,
  radiusMeters: number,
): Promise<Place[]> {
  const query = buildQuery(lat, lon, radiusMeters);
  let lastError: unknown;

  for (const endpoint of ENDPOINTS) {
    try {
      const response = await postWithTimeout(endpoint, query);
      if (!response.ok) {
        lastError = new Error(`${endpoint} responded ${response.status}`);
        continue;
      }

      const body = (await response.json()) as { elements?: OverpassElement[] };
      return (body.elements ?? [])
        .map((element) => toPlace(element, lat, lon))
        .filter((place): place is Place => place !== null)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`All Overpass endpoints failed. Last error: ${lastError}`);
}
