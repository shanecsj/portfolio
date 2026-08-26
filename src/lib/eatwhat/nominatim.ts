import type { LocationMatch } from "./types";
import { USER_AGENT } from "./user-agent";

/**
 * Place-name search (geocoding) via OpenStreetMap's Nominatim.
 *
 * The counterpart to `overpass.ts`: same project, same keyless deal, so the
 * manual-location fallback needs no more configuration than the main lookup.
 *
 * Nominatim's usage policy caps this at one request per second and asks for an
 * identifying User-Agent. The UI submits rather than searching per keystroke,
 * which is what keeps us inside that.
 */

const ENDPOINT = "https://nominatim.openstreetmap.org/search";

/** Geocoding is a single indexed lookup — far quicker than an Overpass scan. */
const TIMEOUT_MS = 6_000;

/** Enough to disambiguate without becoming a wall of options. */
const MAX_MATCHES = 6;

/**
 * ISO country codes the search is confined to. Unrestricted, Nominatim ranks
 * globally by importance, so "Orchard Road" returned three English villages
 * before the Singapore one and "Springfield" returned six US cities — all of
 * them useless as the centre of a walk-to-lunch search.
 *
 * Widen this to add countries, e.g. "sg,my". Empty string would search the
 * whole world again.
 */
const COUNTRY_CODES = "sg";

/**
 * Address tail worth hiding once every result is from the same country: the
 * country name itself, and postcodes. Singapore is a city-state, so "Singapore"
 * shows up as both city and country and would otherwise end every single row.
 */
const REDUNDANT_TAIL = /^(singapore|\d{4,6})$/i;

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

  const tail = segments.slice(segments[0] === name ? 1 : 0);
  while (tail.length > 0 && REDUNDANT_TAIL.test(tail[tail.length - 1])) {
    tail.pop();
  }
  const context = tail.join(", ");

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
 * Drops rows that name the same place at the same address. One mall can be
 * mapped as a relation and two nodes, which Nominatim returns as three hits
 * with identical labels — indistinguishable in the picker, and any of them
 * lands within a few metres of the others. Keeps the first, which is the
 * highest-ranked.
 */
function dedupe(matches: LocationMatch[]): LocationMatch[] {
  const seen = new Set<string>();
  return matches.filter((match) => {
    const key = `${match.name}|${match.context}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
      // Ask for extra: deduplication below can collapse several rows into one,
      // and we would rather still offer a full list afterwards.
      limit: String(MAX_MATCHES * 2),
      countrycodes: COUNTRY_CODES,
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
    return dedupe(
      results.map(toMatch).filter((match): match is LocationMatch => match !== null),
    ).slice(0, MAX_MATCHES);
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
