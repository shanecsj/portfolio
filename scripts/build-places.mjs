/**
 * Regenerates src/data/singapore-places.ts from OpenStreetMap.
 *
 * Why this exists: querying Overpass per request does not work from Vercel.
 * Overpass allows two concurrent slots *per IP* and Vercel's egress addresses
 * are shared across many projects, so we compete for a budget we do not
 * control. Measured against production, a cold lookup took 8.7s at best and
 * 20s-plus or a 502 most of the time, even for the smallest 300 m query.
 *
 * Singapore is small enough to sidestep the whole problem: the entire country
 * holds about 9,000 food places, so we fetch them once here and serve lookups
 * from memory. OSM food data changes far more slowly than the refresh cadence,
 * which is the trade this makes.
 *
 * Usage: npm run build:places
 */

import { writeFile } from "node:fs/promises";

/** Singapore's OSM relation 536780, as an Overpass area id. */
const SINGAPORE_AREA = 3600536780;

const AMENITIES = [
  "restaurant", "cafe", "fast_food", "food_court", "bar", "pub", "ice_cream",
];

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
];

const OUTPUT = new URL("../src/data/singapore-places.ts", import.meta.url);

/**
 * Below this the response is treated as broken rather than as news. Singapore
 * had 9,000 when this was written; a run that suddenly returns a few hundred
 * means a truncated answer or a bad area, and overwriting good data with it
 * would quietly gut the site.
 */
const MINIMUM_PLAUSIBLE = 5_000;

/**
 * Keys whose presence means the place is gone, or was never really there.
 *
 * Most closed places never get marked at all — of 9,000 Singapore entries only
 * three carry any of this — because OSM's usual way of retiring a place is the
 * lifecycle prefix `disused:amenity=restaurant`, and those never match our
 * `[amenity=...]` filter in the first place. What this catches is the
 * leftovers: an entry carrying both a live `amenity` and a `disused:` or
 * `was:` key, which is a half-finished edit and not somewhere to send anyone.
 */
const CLOSED_PREFIXES = ["disused:", "was:", "abandoned:", "removed:", "demolished:"];

/** Tags that say the same thing without a prefix. */
function isClosed(tags) {
  for (const key of Object.keys(tags)) {
    if (CLOSED_PREFIXES.some((prefix) => key.startsWith(prefix))) return true;
  }
  for (const key of ["disused", "abandoned", "closed", "demolished"]) {
    if (tags[key] && tags[key] !== "no") return true;
  }
  const hours = (tags.opening_hours ?? "").trim().toLowerCase();
  if (hours === "closed" || hours === "off") return true;
  // "Foo (closed)", "Foo - permanently closed", and similar hand-written notes.
  if (/\(\s*closed\s*\)|permanently closed|closed down|ceased operation/i.test(tags.name ?? "")) {
    return true;
  }
  return false;
}

/**
 * Looking up the area by tag costs more than the query itself — searching for
 * ISO3166-1=SG timed out at 504, while naming the area id answers in 3s.
 *
 * Split per amenity because `out meta` on all 9,000 at once also 504s, while
 * one amenity at a time answers in about 5s. The metadata is what carries each
 * entry's last-edit date, which is the only handle we have on staleness.
 */
function queryFor(amenity) {
  return [
    "[out:json][timeout:300];",
    `nwr[amenity=${amenity}][name](area:${SINGAPORE_AREA});`,
    "out meta center;",
  ].join("\n");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Waits between whole passes over the endpoints. Overpass allows two
 * concurrent slots per IP and *queues* past that, so "busy" means come back
 * shortly rather than give up — and a refresh that dies on one transient 429
 * is a refresh that silently stops happening.
 */
const RETRY_BACKOFFS_MS = [5_000, 15_000, 45_000, 90_000];

/** Statuses that mean "ask again shortly" rather than "this is broken". */
const BUSY_STATUSES = new Set([429, 502, 503, 504]);

async function fetchOne(query, label) {
  const failures = [];

  for (let attempt = 0; ; attempt++) {
    let busy = false;

    for (const endpoint of ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "shanecsj.dev/eatwhat (https://shanecsj.dev)",
          },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(300_000),
        });

        if (!response.ok) {
          failures.push(`${endpoint} responded ${response.status}`);
          busy ||= BUSY_STATUSES.has(response.status);
          continue;
        }

        const body = await response.json();
        return body.elements ?? [];
      } catch (error) {
        failures.push(`${endpoint}: ${error}`);
        // A dropped connection is usually the far end shedding load too.
        busy = true;
      }
    }

    const backoff = RETRY_BACKOFFS_MS[attempt];
    if (!busy || backoff === undefined) break;
    process.stdout.write(`busy, retrying in ${backoff / 1000}s … `);
    await sleep(backoff);
  }

  throw new Error(`Every Overpass endpoint failed for ${label}. ${failures.join("; ")}`);
}

async function fetchElements() {
  const all = [];
  for (const [index, amenity] of AMENITIES.entries()) {
    process.stdout.write(`  ${amenity} … `);
    const elements = await fetchOne(queryFor(amenity), amenity);
    console.log(`${elements.length}`);
    all.push(...elements);
    // Pace the seven queries so we are not the reason the next one is refused.
    if (index < AMENITIES.length - 1) await sleep(8_000);
  }
  return all;
}

/**
 * One row per place, tab-separated:
 * id, name, amenity, cuisine, lat, lon, lastEdited, openingHours.
 */
function toRow(element) {
  const tags = element.tags ?? {};
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (!tags.name || lat === undefined || lon === undefined) return null;
  if (isClosed(tags)) return null;

  // Tabs and newlines are the delimiters, so they cannot survive in a value.
  // Nothing else needs escaping, which is the point of choosing them.
  const clean = (value) => value.replace(/[\t\n\r]+/g, " ").trim();

  return [
    `${element.type[0]}${element.id}`,
    clean(tags.name),
    tags.amenity ?? "",
    clean(tags.cuisine ?? ""),
    // Six decimals is about 10 cm — far past anything that matters here, and
    // two characters shorter per coordinate than the raw values.
    Number(lat).toFixed(6),
    Number(lon).toFixed(6),
    // When OSM last heard anything about this place. A verified survey beats
    // the edit date, which can be a bot touching an unrelated tag.
    (tags["check_date"] ?? tags["survey:date"] ?? element.timestamp ?? "").slice(0, 10),
    // Present on about a fifth of places. Kept raw, in OSM's own syntax —
    // the UI tidies the common shapes and shows anything unusual verbatim.
    clean(tags.opening_hours ?? ""),
  ].join("\t");
}

const elements = await fetchElements();
const kept = elements.map(toRow).filter((row) => row !== null);
console.log(`\n  ${elements.length} fetched, ${elements.length - kept.length} dropped as closed or unusable`);
const rows = kept
  // Sorted so an unchanged planet produces an unchanged file, and a refresh
  // diff shows what actually moved rather than Overpass's ordering.
  .sort();

if (rows.length < MINIMUM_PLAUSIBLE) {
  throw new Error(
    `Only ${rows.length} places, below the ${MINIMUM_PLAUSIBLE} floor — refusing to overwrite the dataset.`,
  );
}

const generated = new Date().toISOString().slice(0, 10);
const file = `// Generated by scripts/build-places.mjs — do not edit by hand.
// Run \`npm run build:places\` to refresh.
//
// Every food place in Singapore, from OpenStreetMap. Held as one tab-separated
// string rather than JSON or an array literal: TypeScript would otherwise infer
// a literal type per row, and ${rows.length} of those makes typechecking crawl. The
// \`: string\` annotation is load-bearing for the same reason — it stops the
// literal type being retained.
//
// Columns: id, name, amenity, cuisine, lat, lon, lastEdited, openingHours.

/** ISO date the dataset was pulled. */
export const GENERATED: string = ${JSON.stringify(generated)};

/** How many places it holds. */
export const COUNT: number = ${rows.length};

export const ROWS: string = ${JSON.stringify(rows.join("\n"))};
`;

await writeFile(OUTPUT, file);
console.log(`\nWrote ${rows.length} places (${(file.length / 1024).toFixed(0)} KB) to src/data/singapore-places.ts`);
