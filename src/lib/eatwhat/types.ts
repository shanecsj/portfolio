/**
 * The shape the /eatwhat UI speaks. Providers (Overpass today, Google Places
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

/**
 * A place the visitor searched for by name, used as the centre of the food
 * lookup when geolocation is denied, unavailable, or simply not what they
 * wanted (planning tonight's dinner from the office, say).
 */
export type LocationMatch = {
  /** Nominatim's place_id. Unique, and present on every result. */
  id: string;
  /** Heading, e.g. "VivoCity". */
  name: string;
  /** What distinguishes it from the other matches, e.g. "Bukit Merah, Singapore". */
  context: string;
  lat: number;
  lon: number;
};

export type GeocodeResult = { matches: LocationMatch[] };
