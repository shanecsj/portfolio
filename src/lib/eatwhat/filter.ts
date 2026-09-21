import type { Place } from "./types";

/**
 * Narrowing the pool the randomiser draws from.
 *
 * Filtering happens here, in the browser, over the places already fetched —
 * never by re-querying. The whole list is sent down precisely so that
 * rerolling and refining are instant and cost no Overpass slot, and a filter
 * is no different from a reroll in that respect.
 */

/** One chip: what it matches, and how many of the current places it would keep. */
export type FilterOption = { value: string; count: number };

export type Filters = { categories: string[]; cuisines: string[] };

export const NO_FILTERS: Filters = { categories: [], cuisines: [] };

export function hasFilters(filters: Filters): boolean {
  return filters.categories.length > 0 || filters.cuisines.length > 0;
}

/** Adds or removes one value, leaving the rest of the selection alone. */
export function toggle(selection: string[], value: string): string[] {
  return selection.includes(value)
    ? selection.filter((entry) => entry !== value)
    : [...selection, value];
}

/**
 * Counts, then orders by usefulness: commonest first, ties alphabetical.
 *
 * Selected values are always included even when nothing matches them, so a
 * filter carried over from a previous search cannot end up applied but
 * invisible — the chip stays on screen, showing 0, where it can be turned off.
 */
function toOptions(
  counts: Map<string, number>,
  selected: string[],
): FilterOption[] {
  for (const value of selected) {
    if (!counts.has(value)) counts.set(value, 0);
  }

  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function categoryOptions(
  places: Place[],
  selected: string[],
): FilterOption[] {
  const counts = new Map<string, number>();
  for (const place of places) {
    counts.set(place.category, (counts.get(place.category) ?? 0) + 1);
  }
  return toOptions(counts, selected);
}

export function cuisineOptions(
  places: Place[],
  selected: string[],
): FilterOption[] {
  const counts = new Map<string, number>();
  for (const place of places) {
    // A place tagged "cake;malaysian" counts towards both groups, because a
    // filter on either should find it.
    for (const group of place.cuisineGroups) {
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
  }
  return toOptions(counts, selected);
}

/**
 * How many places carry any cuisine group at all. Shown next to the cuisine
 * chips, because OSM tags cuisine on well under half of places and a visitor
 * deserves to know that "Chinese (3)" means three *tagged* Chinese places
 * rather than three Chinese places.
 */
export function cuisineTaggedCount(places: Place[]): number {
  return places.filter((place) => place.cuisineGroups.length > 0).length;
}

/**
 * Within a row, any selected value matches (pick Cafe or Bar and you get
 * both). Across the two rows, both must match (Cafe plus Chinese means
 * Chinese cafes). An empty row is not a filter.
 */
export function applyFilters(places: Place[], filters: Filters): Place[] {
  const { categories, cuisines } = filters;
  if (categories.length === 0 && cuisines.length === 0) return places;

  return places.filter(
    (place) =>
      (categories.length === 0 || categories.includes(place.category)) &&
      (cuisines.length === 0 ||
        place.cuisineGroups.some((group) => cuisines.includes(group))),
  );
}
