import type { NextRequest } from "next/server";
import { findNearbyPlaces } from "@/lib/eatwhat/places";
import type { ApiError, NearbyPlacesResult } from "@/lib/eatwhat/types";

/**
 * GET /api/eatwhat?lat=&lon=&radius=&min=
 *
 * Returns every nearby food place; the client does the randomising so that
 * "try another" is instant and doesn't re-hit the API.
 *
 * Route handlers are uncached by default, which is what we want — the answer
 * depends entirely on the caller's coordinates.
 *
 * No `maxDuration` override any more. It was 30s to survive a queued Overpass;
 * the lookup is now a filter over an in-memory array and answers in about a
 * millisecond, so the platform default is far more than enough.
 */

const DEFAULT_RADIUS_M = 1000;
/** Low enough for the walkable band, whose outer edge is only 300 m. */
const MIN_RADIUS_M = 100;
const MAX_RADIUS_M = 5000;

function badRequest(message: string) {
  return Response.json({ error: message } satisfies ApiError, { status: 400 });
}

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return badRequest("`lat` must be a number between -90 and 90.");
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    return badRequest("`lon` must be a number between -180 and 180.");
  }

  const rawRadius = params.get("radius");
  const radius = rawRadius === null ? DEFAULT_RADIUS_M : Number(rawRadius);
  if (!Number.isFinite(radius) || radius < MIN_RADIUS_M || radius > MAX_RADIUS_M) {
    return badRequest(
      `\`radius\` must be between ${MIN_RADIUS_M} and ${MAX_RADIUS_M} metres.`,
    );
  }

  // `min` turns the disc into a band, so "by car" stops suggesting the cafe
  // next door. Absent means a plain disc from zero.
  const rawMin = params.get("min");
  const min = rawMin === null ? 0 : Number(rawMin);
  if (!Number.isFinite(min) || min < 0 || min >= radius) {
    return badRequest("`min` must be a number between 0 and `radius`.");
  }

  // No try/catch and no 502: there is nothing left to fail. The data ships
  // with the deployment, so the only remaining error is a bad request, which
  // is handled above.
  const { places, totalFound } = findNearbyPlaces(lat, lon, radius, min);

  return Response.json({
    places,
    center: { lat, lon },
    minMeters: min,
    radiusMeters: radius,
    totalFound,
  } satisfies NearbyPlacesResult);
}
