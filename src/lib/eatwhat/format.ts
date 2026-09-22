import type { TravelBand } from "./travel";
import type { Place } from "./types";

/**
 * Metres below a kilometre, then one decimal place — but not a bare ".0",
 * which turns the band labels into "1.5 km – 3.0 km".
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = (meters / 1000).toFixed(1);
  return `${km.endsWith(".0") ? km.slice(0, -2) : km} km`;
}

/** Just the extent: "within 300 m", or "300 m – 800 m". */
function bandRange(band: TravelBand): string {
  if (band.minMeters === 0) return `within ${formatDistance(band.maxMeters)}`;
  return `${formatDistance(band.minMeters)} – ${formatDistance(band.maxMeters)}`;
}

/** A band on its own, e.g. under the mode chips: "300 m – 800 m away". */
export function formatBand(band: TravelBand): string {
  return band.minMeters === 0 ? bandRange(band) : `${bandRange(band)} away`;
}

/**
 * A band tied to where it was measured from: "within 300 m of Bishan", or
 * "300 m – 800 m from Bishan".
 *
 * The preposition has to travel with the range. "within 300 m" wants "of",
 * while a two-ended range wants "from" — gluing a bare " of X" onto the
 * standalone form above yields "300 m – 800 m away of Bishan".
 */
export function formatBandFrom(band: TravelBand, label: string | null): string {
  if (!label) return formatBand(band);
  return band.minMeters === 0
    ? `${bandRange(band)} of ${label}`
    : `${bandRange(band)} from ${label}`;
}

/**
 * OSM's `opening_hours` tidied into something readable, or null.
 *
 * The tag is a small language of its own and most values are simple — "24/7",
 * "Mo-Su 11:00-22:00", a bare "10:30-23:00" — so the common shapes get a
 * friendlier form and anything more elaborate is shown verbatim rather than
 * mangled. No attempt is made to work out whether the place is open *now*:
 * that needs a full parser, and the underlying data is a fifth-covered and
 * often years old, so a confident "Open now" would be a lie dressed as a fact.
 */
export function formatOpeningHours(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  if (value === "24/7") return "Open 24 hours";

  // An en dash reads better than a hyphen between times, everywhere it appears.
  const dashed = value.replace(/(\d)\s*-\s*(\d)/g, "$1–$2");

  // "Mo-Su 11:00-22:00" is just "every day".
  const everyDay = dashed.match(/^Mo\s*[–-]\s*Su\s+(.+)$/i);
  if (everyDay) return `Daily ${everyDay[1]}`;

  return dashed;
}

/**
 * The place on openstreetmap.org, so anyone who finds it shut can fix it.
 *
 * Ids are stored with a one-letter type prefix, which is what the URL needs
 * spelled out.
 */
export function osmUrl(place: Place): string {
  const types: Record<string, string> = { n: "node", w: "way", r: "relation" };
  const type = types[place.id[0]] ?? "node";
  return `https://www.openstreetmap.org/${type}/${place.id.slice(1)}`;
}

/**
 * Directions to the place, by the travel mode that was chosen.
 *
 * Picking "by MRT" is a statement about how you intend to get there, so the
 * link honours it rather than dropping you on a map to work it out again.
 * `travelmode=transit` covers both bus and MRT — Google routes across the
 * network rather than by one vehicle, which is what actually getting there
 * involves anyway.
 *
 * Destination stays "name at lat,lon" rather than bare coordinates: OSM ids
 * mean nothing to Google, but the name resolves to the right place and keeps
 * it legible in the Maps UI, while the coordinates stop it wandering off to a
 * same-named branch across the island. Origin is the search centre, so
 * directions start where the results were measured from.
 */
export function directionsUrl(
  place: Place,
  origin: { lat: number; lon: number },
  band: TravelBand,
): string {
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lon}`,
    destination: `${place.name} ${place.lat},${place.lon}`,
    travelmode: band.mapsMode,
  });
  return `https://www.google.com/maps/dir/?${params}`;
}
