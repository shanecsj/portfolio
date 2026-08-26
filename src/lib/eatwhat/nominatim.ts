import type { LocationMatch } from "./types";
import { USER_AGENT } from "./user-agent";

/**
 * Place-name search (geocoding) via OpenStreetMap's Nominatim.
 *
 * The counterpart to `overpass.ts`: same project, same keyless deal, so the
 * manual-location fallback needs no more configuration than the main lookup.
 *
 * Nominatim's usage policy caps this at one request per second and asks for an
 * identifying User-Agent. The UI debounces rather than searching per keystroke,
 * which is what keeps us inside that.
 */

const ENDPOINT = "https://nominatim.openstreetmap.org/search";

/** Geocoding is a single indexed lookup — far quicker than an Overpass scan. */
const TIMEOUT_MS = 6_000;

/** Enough to disambiguate "Springfield" without becoming a wall of options. */
const MAX_MATCHES = 6;

type NominatimResult = {
  osm_type?: string;
  osm_id?: number;
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
};

/**
 * Splits Nominatim's one long `display_name` into a heading and the rest.
 * "VivoCity, 1, Harbourfront Avenue, …, Singapore" becomes "VivoCity" plus the
 * trailing context, so the picker can show what distinguishes the matches
 * rather than repeating the query six times.
 */
function toMatch(result: NominatimResult): LocationMatch | null {
  const lat = Number(result.lat);
  const lon = Number(result.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const segments = result.display_name.split(",").map((part) => part.trim());
  const name = result.name?.trim() || segments[0] || result.display_name;
  const context = segments
    .slice(segments[0] === name ? 1 : 0)
    .join(", ");

  return {
    // osm_type/osm_id is absent for some synthesised results; place_id always
    // exists and is unique, so it is the safer key.
    id: String(result.place_id),
    name,
    context,
    lat,
    lon,
  };
}

/**
 * Locations matching a free-text query, best match first.
 * Returns an empty array when nothing matches — that is a normal answer, not
 * an error. Throws only if Nominatim itself is unreachable.
 */
export async function searchLocations(query: string): Promise<LocationMatch[]> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);

  try {
    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      limit: String(MAX_MATCHES),
    });
    const response = await fetch(`${ENDPOINT}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Nominatim responded ${response.status}`);
    }

    const results = (await response.json()) as NominatimResult[];
    return results
      .map(toMatch)
      .filter((match): match is LocationMatch => match !== null);
  } catch (error) {
    // Same relabelling as overpass.ts — an abort otherwise reaches the log as
    // an opaque "fetch failed".
    throw timedOut
      ? new Error(`Nominatim did not answer within ${TIMEOUT_MS}ms`)
      : error;
  } finally {
    clearTimeout(timer);
  }
}
