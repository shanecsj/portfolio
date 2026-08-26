import type { NextRequest } from "next/server";
import { searchLocations } from "@/lib/eatwhat/nominatim";
import type { ApiError, GeocodeResult } from "@/lib/eatwhat/types";

/**
 * GET /api/eatwhat/geocode?q=
 *
 * Turns a typed place name into coordinates, so someone who blocked location
 * access — or who wants to plan around somewhere they aren't — can still use
 * the page. Returns every plausible match; the visitor picks, because "Orchard
 * Road" and "Springfield" are genuinely ambiguous and guessing would be worse
 * than asking.
 */

export const maxDuration = 15;

/** Below this a query matches half the planet and the results are noise. */
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 200;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (query.length < MIN_QUERY_LENGTH) {
    return Response.json(
      {
        error: `Search for at least ${MIN_QUERY_LENGTH} characters.`,
      } satisfies ApiError,
      { status: 400 },
    );
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return Response.json(
      { error: "That search is too long." } satisfies ApiError,
      { status: 400 },
    );
  }

  try {
    const matches = await searchLocations(query);
    return Response.json({ matches } satisfies GeocodeResult);
  } catch (error) {
    console.error("[eatwhat] geocode failed", error);
    return Response.json(
      {
        error: "Location search is unavailable right now. Try again shortly.",
      } satisfies ApiError,
      { status: 502 },
    );
  }
}
