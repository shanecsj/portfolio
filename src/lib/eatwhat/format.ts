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
