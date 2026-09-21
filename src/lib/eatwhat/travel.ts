/**
 * How far you are willing to go, expressed the way people actually decide it.
 *
 * A distance in metres is not how anyone thinks about lunch; "walkable" or
 * "worth driving to" is. Each mode is a *band* rather than a radius, so it
 * excludes what the easier mode already covers — say you are driving and the
 * cafe 200 m away is not an answer, it is a non-answer. Banding is what makes
 * the four choices give genuinely different suggestions.
 *
 * Be honest about what this is: a radius is a crude proxy for a bus or train
 * journey, which really means "near a stop", not "within N metres". The label
 * names the mode that makes the distance reasonable; it does not model the
 * network. Real transit isochrones would be a different feature entirely.
 */

export type TravelMode = "walk" | "bus" | "mrt" | "car";

export type TravelBand = {
  id: TravelMode;
  label: string;
  /** Inclusive floor in metres. Anything nearer belongs to an easier mode. */
  minMeters: number;
  /** Outer edge in metres. */
  maxMeters: number;
  /** Google Maps `travelmode`, used for the directions link. */
  mapsMode: "walking" | "transit" | "driving";
};

/**
 * Deliberately tight. Singapore is dense enough that 3 km is already a
 * ten-minute drive, and the earlier 500 m / 1 km / 2 km set put everything in
 * one band of "a walk, roughly" without distinguishing the modes at all.
 */
export const TRAVEL_BANDS: readonly TravelBand[] = [
  { id: "walk", label: "Walkable", minMeters: 0, maxMeters: 300, mapsMode: "walking" },
  { id: "bus", label: "By bus", minMeters: 300, maxMeters: 800, mapsMode: "transit" },
  { id: "mrt", label: "By MRT", minMeters: 800, maxMeters: 1500, mapsMode: "transit" },
  { id: "car", label: "By car", minMeters: 1500, maxMeters: 3000, mapsMode: "driving" },
] as const;

export const DEFAULT_MODE: TravelMode = "walk";

export function bandFor(mode: TravelMode): TravelBand {
  return TRAVEL_BANDS.find((band) => band.id === mode) ?? TRAVEL_BANDS[0];
}
