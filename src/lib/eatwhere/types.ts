/**
 * The shape the /eatwhere UI speaks. Providers (Overpass today, Google Places
 * or Foursquare later) normalise into this, so swapping the data source never
 * reaches the component.
 */
export type Place = {
  /** Unique within a provider. Used as a React key and to avoid repeat picks. */
  id: string;
  name: string;
  /** Humanised amenity, e.g. "Cafe", "Fast food". */
  category: string;
  /** Humanised cuisine tags. Often empty — OSM coverage is patchy. */
  cuisines: string[];
  lat: number;
  lon: number;
  /** Straight-line metres from the search centre, not walking distance. */
  distanceMeters: number;
};

export type NearbyPlacesResult = {
  places: Place[];
  center: { lat: number; lon: number };
  radiusMeters: number;
};

export type ApiError = { error: string };
