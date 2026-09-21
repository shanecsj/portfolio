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
  /** Humanised cuisine tags, for display. Often empty — OSM coverage is patchy. */
  cuisines: string[];
  /**
   * The same tags folded into filterable groups by `cuisine.ts`. Separate from
   * `cuisines` because the raw values are far too numerous and too inconsistent
   * to choose from, while these are stable enough to be a filter. Empty when
   * the place is untagged or tagged only with something too vague to group.
   */
  cuisineGroups: string[];
  lat: number;
  lon: number;
  /** Straight-line metres from the search centre, not walking distance. */
  distanceMeters: number;
};

export type NearbyPlacesResult = {
  places: Place[];
  center: { lat: number; lon: number };
  /** Band floor. Places nearer than this belong to an easier travel mode. */
  minMeters: number;
  /** Band ceiling. */
  radiusMeters: number;
  /**
   * How many places the band actually holds, before any sampling. Equal to
   * `places.length` unless the area was too dense to send in full — Orchard
   * within 3 km is over 2,600 — in which case the UI says so rather than
   * implying the pick came from a complete list.
   */
  totalFound: number;
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
