"use client";

import {
  categoryOptions,
  cuisineOptions,
  cuisineTaggedCount,
  hasFilters,
  type FilterOption,
  type Filters,
} from "@/lib/eatwhat/filter";
import type { Place } from "@/lib/eatwhat/types";

/**
 * The two rows of chips that narrow what the randomiser picks from.
 *
 * Options are derived from the places actually found rather than hardcoded, so
 * a chip never offers something the neighbourhood cannot deliver, the counts
 * show how thin the data is before you rely on it, and the list follows
 * whatever is around — a mall food court and a nightlife street offer very
 * different rows.
 */

type Props = {
  places: Place[];
  filters: Filters;
  onToggleCategory: (value: string) => void;
  onToggleCuisine: (value: string) => void;
  onClear: () => void;
  disabled: boolean;
};

const ROW_LABEL =
  "text-xs font-semibold tracking-[0.14em] text-faint uppercase";

function Chip({
  option,
  selected,
  onToggle,
  disabled,
}: {
  option: FilterOption;
  selected: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      // Not a toggle button by accident: aria-pressed is what tells a screen
      // reader this filter is on, since the styling alone cannot.
      aria-pressed={selected}
      onClick={onToggle}
      disabled={disabled}
      className={
        selected
          ? "cursor-pointer rounded-full border border-ink bg-ink px-3.5 py-1.5 text-sm text-canvas disabled:cursor-not-allowed disabled:opacity-60"
          : "cursor-pointer rounded-full border border-rule px-3.5 py-1.5 text-sm text-muted hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {option.value}{" "}
      <span className={selected ? "text-canvas/60" : "text-faint"}>
        {option.count}
      </span>
    </button>
  );
}

export function PlaceFilters({
  places,
  filters,
  onToggleCategory,
  onToggleCuisine,
  onClear,
  disabled,
}: Props) {
  const categories = categoryOptions(places, filters.categories);
  const cuisines = cuisineOptions(places, filters.cuisines);
  const tagged = cuisineTaggedCount(places);

  // One category is no choice at all — every place in range is a restaurant,
  // and a lone chip that filters nothing is just clutter.
  const showCategories = categories.length > 1;
  const showCuisines = cuisines.length > 1;
  if (!showCategories && !showCuisines) return null;

  return (
    <div className="mt-8 border-t border-rule pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className={ROW_LABEL}>Narrow it down</p>
        {hasFilters(filters) ? (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="text-sm text-accent hover:underline disabled:opacity-60"
          >
            Clear
          </button>
        ) : null}
      </div>

      {showCategories ? (
        <div className="mt-4">
          <p className="text-xs text-faint">Type</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {categories.map((option) => (
              <Chip
                key={option.value}
                option={option}
                selected={filters.categories.includes(option.value)}
                onToggle={() => onToggleCategory(option.value)}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      ) : null}

      {showCuisines ? (
        <div className="mt-5">
          {/* The tagged share is stated up front. OSM records cuisine on well
              under half of places, so "Chinese 3" means three tagged Chinese
              places, not three Chinese places, and filtering here always hides
              some real ones. */}
          <p className="text-xs text-faint">
            Cuisine · tagged on {tagged} of {places.length}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {cuisines.map((option) => (
              <Chip
                key={option.value}
                option={option}
                selected={filters.cuisines.includes(option.value)}
                onToggle={() => onToggleCuisine(option.value)}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
