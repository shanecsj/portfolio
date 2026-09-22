import { COUNT, GENERATED, ROWS } from "@/data/singapore-places";
import { toCuisineGroups } from "./cuisine";
import { haversineMeters } from "./distance";
import type { Place } from "./types";

/**
 * Nearby-food lookups, served from a dataset built into the deployment.
 *
 * This replaces querying Overpass per request, which does not work from
 * Vercel. Overpass allows two concurrent slots *per IP*, and Vercel's egress
 * addresses are shared across many projects, so we were competing for a budget
 * we do not control. Measured against production: a cold lookup took 8.7s at
 * best and 20s-plus or an outright 502 most of the time — and the band that
 * failed most was the *smallest*, which is what ruled out query weight as the
 * cause. Caching helped only the second visitor to any one spot, and every
 * visitor searching somewhere new paid the cold price.
 *
 * Singapore holds about 9,000 food places in total, so the whole country fits
 * in memory and a lookup becomes a filter over an array. No network call, no
 * rate limit, no failure mode. `scripts/build-places.mjs` regenerates the data;
 * the trade is that it is only as fresh as the last refresh, which OSM food
 * data comfortably tolerates.
 */

/** How many places are sent to the browser. See `sample` for why it is a cap. */
const MAX_RESULTS = 150;

/** Metres per degree of latitude. Close enough anywhere for a coarse prefilter. */
const METRES_PER_DEGREE_LAT = 111_320;

type PlaceRecord = {
  id: string;
  name: string;
  amenity: string;
  cuisine: string;
  lat: number;
  lon: number;
  lastConfirmed: string;
  openingHours: string;
};

/** What a lookup yields: the sample sent on, and how big the band really is. */
export type NearbyPlaces = { places: Place[]; totalFound: number };

/** When the built-in dataset was pulled, for the note on the page. */
export const DATASET = { generated: GENERATED, count: COUNT };

/**
 * Parsed once per serverless instance at module load — roughly 9,000 rows, a
 * few milliseconds, paid once instead of on every request.
 */
const PLACES: PlaceRecord[] = ROWS.split("\n").map((row) => {
  const [id, name, amenity, cuisine, lat, lon, lastConfirmed, openingHours] =
    row.split("\t");
  return {
    id,
    name,
    amenity,
    cuisine,
    lat: Number(lat),
    lon: Number(lon),
    lastConfirmed,
    openingHours,
  };
});

/** "fast_food" -> "Fast food". */
function humanise(value: string): string {
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function toPlace(record: PlaceRecord, distanceMeters: number): Place {
  return {
    id: record.id,
    name: record.name,
    category: humanise(record.amenity || "place"),
    // The cuisine tag is a semicolon-separated list, e.g. "chinese;noodle".
    cuisines: record.cuisine
      ? record.cuisine.split(";").map((entry) => humanise(entry.trim()))
      : [],
    // Derived at read time rather than stored, so revising the grouping in
    // cuisine.ts takes effect without regenerating the dataset.
    cuisineGroups: toCuisineGroups(record.cuisine),
    lat: record.lat,
    lon: record.lon,
    distanceMeters,
    openingHours: record.openingHours || null,
    lastConfirmed: record.lastConfirmed || null,
  };
}

/**
 * Trims a band to `MAX_RESULTS` by sampling it uniformly at random.
 *
 * Not "the nearest N", which would be wrong for a band: the 1.5-3 km ring
 * around Orchard holds thousands, and its nearest 150 all sit within a few
 * metres of the 1.5 km floor. Choosing to go by car and only ever being sent
 * to the closest edge of the band defeats the point of having bands.
 *
 * Partial Fisher-Yates: shuffles only the prefix it needs.
 */
function sample<T>(items: T[], size: number): T[] {
  if (items.length <= size) return items;

  const pool = [...items];
  for (let i = 0; i < size; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, size);
}

/**
 * Places in the band `minMeters`-`radiusMeters` around the given point,
 * nearest first, sampled down to `MAX_RESULTS` if the band is dense.
 *
 * Never throws and never blocks: the answer is already in memory.
 */
export function findNearbyPlaces(
  lat: number,
  lon: number,
  radiusMeters: number,
  minMeters = 0,
): NearbyPlaces {
  // A degree box first, so the great-circle maths runs on a handful of
  // candidates rather than all 9,000. The box is deliberately loose — it only
  // has to be a superset of the disc, and the exact test follows.
  const latSpan = radiusMeters / METRES_PER_DEGREE_LAT;
  const lonSpan =
    radiusMeters /
    (METRES_PER_DEGREE_LAT * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));

  const found: Place[] = [];
  for (const record of PLACES) {
    if (Math.abs(record.lat - lat) > latSpan) continue;
    if (Math.abs(record.lon - lon) > lonSpan) continue;

    const distance = haversineMeters(lat, lon, record.lat, record.lon);
    if (distance > radiusMeters || distance < minMeters) continue;

    found.push(toPlace(record, distance));
  }

  return {
    places: sample(found, MAX_RESULTS).sort(
      (a, b) => a.distanceMeters - b.distanceMeters,
    ),
    totalFound: found.length,
  };
}
