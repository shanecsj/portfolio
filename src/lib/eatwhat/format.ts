import type { Place } from "./types";

/** Metres below a kilometre, then one decimal place. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * A Maps *search* URL rather than a pin: OSM ids mean nothing to Google, but
 * "name at lat,lon" resolves to the right place and opens the native app on a
 * phone while still working in a desktop browser.
 */
export function mapsUrl(place: Place): string {
  const query = `${place.name} ${place.lat},${place.lon}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
