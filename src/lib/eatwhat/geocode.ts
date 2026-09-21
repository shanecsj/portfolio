import { haversineMeters } from "./distance";
import { searchNominatim } from "./nominatim";
import { searchOneMap } from "./onemap";
import type { LocationMatch } from "./types";

/**
 * The geocoder the route handler talks to: OneMap and Nominatim, merged.
 *
 * Neither is sufficient alone. Measured against the same queries, OneMap
 * resolves "530101" to the right HDB block while Nominatim returns nothing,
 * and Nominatim finds "Kopitiam Bedok" while OneMap returns nothing — OneMap
 * indexes registered premises, OSM indexes whatever a mapper walked past.
 * Running both and interleaving is what makes the picker feel comprehensive.
 *
 * Both are free and need no billing account, which is the whole reason this
 * sits here rather than on Google Places: a geocoder behind a card is a
 * geocoder someone can run up a bill on.
 */

/** Enough to disambiguate without becoming a wall of options. */
const MAX_MATCHES = 6;

/**
 * How close two same-named results must be to count as one place.
 *
 * Generous on purpose. OneMap lists "Jewel @ Buangkok" once per HDB block, and
 * those blocks sit a couple of hundred metres apart — four rows that are
 * indistinguishable to someone choosing where to eat. Well under the smallest
 * search radius (500 m), so collapsing them cannot change which food places
 * the lookup then finds.
 */
const DUPLICATE_RADIUS_M = 250;

/** Strips punctuation and case so "Jewel @Buangkok" matches "JEWEL @ BUANGKOK". */
function normaliseName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Drops the second mention of a place already in the list. Name alone would be
 * too aggressive — Singapore has a Kopitiam in most estates, and those are
 * genuinely different destinations — so proximity has to agree.
 */
function dedupe(matches: LocationMatch[]): LocationMatch[] {
  const kept: LocationMatch[] = [];

  for (const match of matches) {
    const key = normaliseName(match.name);
    const duplicate = kept.some(
      (existing) =>
        normaliseName(existing.name) === key &&
        haversineMeters(existing.lat, existing.lon, match.lat, match.lon) <
          DUPLICATE_RADIUS_M,
    );
    if (!duplicate) kept.push(match);
  }

  return kept;
}

/**
 * Alternates between the two lists, so a short final list still shows what
 * each provider is best at instead of one of them filling every row.
 *
 * Nominatim leads because it ranks by prominence: for "Tampines Hub" it puts
 * Our Tampines Hub first, where OneMap's index offers "Enabling Services Hub
 * (ESH) @ Tampines" ahead of it. OneMap needs no special case for postcodes —
 * Nominatim simply returns nothing for those, so OneMap fills the list.
 */
function interleave(
  primary: LocationMatch[],
  secondary: LocationMatch[],
): LocationMatch[] {
  const merged: LocationMatch[] = [];
  for (let i = 0; i < Math.max(primary.length, secondary.length); i++) {
    if (i < primary.length) merged.push(primary[i]);
    if (i < secondary.length) merged.push(secondary[i]);
  }
  return merged;
}

/** Unwraps a settled provider, logging rather than failing the whole search. */
function resolve(
  provider: string,
  outcome: PromiseSettledResult<LocationMatch[]>,
): LocationMatch[] {
  if (outcome.status === "fulfilled") return outcome.value;
  console.error(`[eatwhat] ${provider} geocode failed`, outcome.reason);
  return [];
}

/**
 * Locations matching a free-text query, best match first.
 *
 * Queries both providers in parallel and survives either one failing — a
 * half-length list is a better answer than an error, and the two go down
 * independently. Throws only when *both* are unreachable, which the route
 * handler turns into a 502. An empty array is a normal answer, not a failure.
 */
export async function searchLocations(query: string): Promise<LocationMatch[]> {
  const [nominatim, onemap] = await Promise.allSettled([
    searchNominatim(query),
    searchOneMap(query),
  ]);

  if (nominatim.status === "rejected" && onemap.status === "rejected") {
    throw new Error(
      `Both geocoders failed. Nominatim: ${nominatim.reason}. OneMap: ${onemap.reason}.`,
    );
  }

  return dedupe(
    interleave(resolve("Nominatim", nominatim), resolve("OneMap", onemap)),
  ).slice(0, MAX_MATCHES);
}
