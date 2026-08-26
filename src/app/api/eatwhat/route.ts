import type { NextRequest } from "next/server";
import { fetchNearbyPlaces } from "@/lib/eatwhat/overpass";
import type { ApiError, NearbyPlacesResult } from "@/lib/eatwhat/types";

/**
 * GET /api/eatwhat?lat=&lon=&radius=
 *
 * Returns every nearby food place; the client does the randomising so that
 * "try another" is instant and doesn't re-hit the upstream API.
 *
 * Route handlers are uncached by default, which is what we want — the answer
 * depends entirely on the caller's coordinates.
 */

/**
 * Vercel's default function budget is 10s, which is tight when the free
 * Overpass instance queues us and we fall through to the second endpoint.
 */
export const maxDuration = 30;

const DEFAULT_RADIUS_M = 1000;
const MIN_RADIUS_M = 200;
const MAX_RADIUS_M = 5000;

function badRequest(message: string) {
  return Response.json({ error: message } satisfies ApiError, { status: 400 });
}

export async function GET(request: NextRequest) {
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

  try {
    const places = await fetchNearbyPlaces(lat, lon, radius);
    return Response.json({
      places,
      center: { lat, lon },
      radiusMeters: radius,
    } satisfies NearbyPlacesResult);
  } catch (error) {
    console.error("[eatwhat] lookup failed", error);
    return Response.json(
      {
        // Almost always rate-limiting on the free Overpass instance rather
        // than anything wrong on our side, so the advice is "wait", not "retry
        // harder".
        error:
          "The places service is busy right now — give it a few seconds and try again.",
      } satisfies ApiError,
      { status: 502 },
    );
  }
}
