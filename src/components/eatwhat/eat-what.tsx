"use client";

import { useRef, useState } from "react";
import {
  applyFilters,
  hasFilters,
  NO_FILTERS,
  toggle,
  type Filters,
} from "@/lib/eatwhat/filter";
import {
  directionsUrl,
  formatBand,
  formatBandFrom,
  formatDistance,
  formatOpeningHours,
  osmUrl,
} from "@/lib/eatwhat/format";
import {
  bandFor,
  DEFAULT_MODE,
  TRAVEL_BANDS,
  type TravelMode,
} from "@/lib/eatwhat/travel";
import { PlaceFilters } from "@/components/eatwhat/place-filters";
import type {
  ApiError,
  GeocodeResult,
  LocationMatch,
  NearbyPlacesResult,
  Place,
} from "@/lib/eatwhat/types";

/** Where we search from: the device's own fix, or somewhere typed in. */
type Origin =
  | { kind: "device"; lat: number; lon: number }
  | { kind: "named"; label: string; lat: number; lon: number };

type Status = "idle" | "locating" | "searching" | "ready" | "error";
type SearchStatus = "idle" | "searching" | "done" | "error";

function originLabel(origin: Origin): string {
  return origin.kind === "device" ? "your location" : origin.label;
}

/** Promise wrapper around the callback-style geolocation API. */
function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("This browser has no location support."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      // Coarse is plenty for "what's within a kilometre", and it resolves far
      // faster than a GPS fix on mobile.
      enableHighAccuracy: false,
      timeout: 10_000,
      maximumAge: 60_000,
    });
  });
}

function geolocationMessage(error: unknown): string {
  if (
    typeof GeolocationPositionError !== "undefined" &&
    error instanceof GeolocationPositionError
  ) {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return "Location permission is blocked for this site.";
      case error.POSITION_UNAVAILABLE:
        return "Your device could not work out where it is.";
      case error.TIMEOUT:
        return "Timed out waiting for your location.";
    }
  }
  return error instanceof Error ? error.message : "Could not get your location.";
}

/** A random place, avoiding an immediate repeat when there's a choice. */
function pickRandom(places: Place[], avoid: Place | null): Place {
  const pool =
    avoid && places.length > 1
      ? places.filter((place) => place.id !== avoid.id)
      : places;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function EatWhat() {
  const [mode, setMode] = useState<TravelMode>(DEFAULT_MODE);
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [places, setPlaces] = useState<Place[]>([]);
  const [pick, setPick] = useState<Place | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Kept across lookups: wanting a cafe is a standing preference, not a
  // property of one search. Options are recomputed per result set, and a
  // selection that no longer matches anything still renders, showing 0.
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  // How many places the band really holds. Above MAX_RESULTS the server sends
  // a random sample, and the result line says so rather than implying the pick
  // came from everything nearby.
  const [totalFound, setTotalFound] = useState(0);

  // Manual location search.
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<LocationMatch[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [searchError, setSearchError] = useState<string | null>(null);
  const queryInput = useRef<HTMLInputElement>(null);

  const busy = status === "locating" || status === "searching";
  /** What the randomiser is actually drawing from, after the chips. */
  const pool = applyFilters(places, filters);
  const band = bandFor(mode);

  function openSearch() {
    setSearchOpen(true);
    // Focus lands on the input so the panel is usable straight from the
    // keyboard, and because opening it always means "I want to type now".
    requestAnimationFrame(() => queryInput.current?.focus());
  }

  /**
   * The food lookup itself. Takes the origin explicitly — state set earlier in
   * the same handler would not have flushed yet.
   */
  async function runLookup(from: Origin, withMode: TravelMode) {
    const band = bandFor(withMode);
    setStatus("searching");
    setError(null);
    setPick(null);
    setPlaces([]);
    setTotalFound(0);

    try {
      const params = new URLSearchParams({
        lat: String(from.lat),
        lon: String(from.lon),
        radius: String(band.maxMeters),
        min: String(band.minMeters),
      });
      const response = await fetch(`/api/eatwhat?${params}`);
      const body: NearbyPlacesResult | ApiError = await response.json();

      if (!response.ok) {
        setError("error" in body ? body.error : "The lookup failed.");
        setStatus("error");
        return;
      }

      const result = body as NearbyPlacesResult;
      const found = result.places;
      if (found.length === 0) {
        setError(
          `Nothing on the map ${formatBandFrom(band, originLabel(from))}. Try another way of getting there, or a different spot.`,
        );
        setStatus("error");
        return;
      }
      setTotalFound(result.totalFound);

      setPlaces(found);
      // Filters survive the new lookup, so the first pick has to respect them.
      // An empty pool is not an error — the places are there, the filter just
      // excludes them — so it gets its own branch in the result area.
      const pool = applyFilters(found, filters);
      setPick(pool.length > 0 ? pickRandom(pool, null) : null);
      setStatus("ready");
    } catch {
      setError("Could not reach the server. Check your connection and retry.");
      setStatus("error");
    }
  }

  /** Main button. Reuses a chosen origin; otherwise asks the device. */
  async function handleEatWhat() {
    if (origin) {
      await runLookup(origin, mode);
      return;
    }

    setError(null);
    setStatus("locating");
    try {
      const position = await getPosition();
      const next: Origin = {
        kind: "device",
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      };
      setOrigin(next);
      await runLookup(next, mode);
    } catch (locationError) {
      // Denied or unavailable is not a dead end — offer the way round it
      // immediately rather than making them hunt for it.
      setError(
        `${geolocationMessage(locationError)} Search for a place instead.`,
      );
      setStatus("error");
      openSearch();
    }
  }

  async function handleUseDevice() {
    setError(null);
    setStatus("locating");
    try {
      const position = await getPosition();
      const next: Origin = {
        kind: "device",
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      };
      setOrigin(next);
      setSearchOpen(false);
      await runLookup(next, mode);
    } catch (locationError) {
      setError(geolocationMessage(locationError));
      setStatus("error");
    }
  }

  async function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    setSearchStatus("searching");
    setSearchError(null);
    setMatches([]);

    try {
      const response = await fetch(
        `/api/eatwhat/geocode?q=${encodeURIComponent(trimmed)}`,
      );
      const body: GeocodeResult | ApiError = await response.json();

      if (!response.ok) {
        setSearchError("error" in body ? body.error : "The search failed.");
        setSearchStatus("error");
        return;
      }

      setMatches((body as GeocodeResult).matches);
      setSearchStatus("done");
    } catch {
      setSearchError("Could not reach the server.");
      setSearchStatus("error");
    }
  }

  /** Picking a match is a commitment — go straight to the food lookup. */
  async function handleChooseMatch(match: LocationMatch) {
    const next: Origin = {
      kind: "named",
      label: match.name,
      lat: match.lat,
      lon: match.lon,
    };
    setOrigin(next);
    setSearchOpen(false);
    setMatches([]);
    setQuery("");
    setSearchStatus("idle");
    await runLookup(next, mode);
  }

  function handleReroll() {
    const pool = applyFilters(places, filters);
    if (pool.length === 0) return;
    setPick((current) => pickRandom(pool, current));
  }

  /**
   * Changing a filter re-picks immediately. Narrowing to "Japanese" is a
   * request for somewhere Japanese, so leaving the previous suggestion sitting
   * there would answer the wrong question — and the pool is already local, so
   * it costs nothing.
   */
  function applyAndRepick(next: Filters) {
    setFilters(next);
    const pool = applyFilters(places, next);
    setPick(pool.length > 0 ? pickRandom(pool, null) : null);
  }

  return (
    <div>
      <fieldset disabled={busy} className="mt-8">
        <legend className="text-xs font-semibold tracking-[0.14em] text-faint uppercase">
          Getting there
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {TRAVEL_BANDS.map((option) => {
            const selected = option.id === mode;
            return (
              <label
                key={option.id}
                className={
                  selected
                    ? "cursor-pointer rounded-full border border-ink bg-ink px-4 py-1.5 text-sm text-canvas"
                    : "cursor-pointer rounded-full border border-rule px-4 py-1.5 text-sm text-muted hover:border-ink hover:text-ink"
                }
              >
                <input
                  type="radio"
                  name="mode"
                  value={option.id}
                  checked={selected}
                  onChange={() => setMode(option.id)}
                  className="sr-only"
                />
                {option.label}
              </label>
            );
          })}
        </div>
        {/* The band is spelled out, because "By MRT" is a label for a distance
            rather than a routed journey and should not pretend otherwise. */}
        <p className="mt-2.5 text-xs text-faint">
          Looking {formatBand(band)}
          {band.minMeters > 0 ? ", skipping what is closer" : ""}
        </p>
      </fieldset>

      {/* Current origin, and the way to change it. Always reachable — someone
          may want to plan around a place they are not standing in. */}
      <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <span className="text-muted">
          {origin ? (
            <>
              Searching near{" "}
              <span className="font-medium text-ink">{originLabel(origin)}</span>
            </>
          ) : (
            "Searching near your location"
          )}
        </span>
        <button
          type="button"
          onClick={() => (searchOpen ? setSearchOpen(false) : openSearch())}
          disabled={busy}
          className="text-accent hover:underline disabled:opacity-60"
        >
          {searchOpen ? "Cancel" : origin ? "Change" : "Use another place"}
        </button>
      </div>

      {searchOpen ? (
        <div className="mt-4 rounded-xl border border-rule p-4">
          <form onSubmit={handleSearchSubmit}>
            <label
              htmlFor="location-query"
              className="text-xs font-semibold tracking-[0.14em] text-faint uppercase"
            >
              Search a location in Singapore
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                id="location-query"
                ref={queryInput}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Bishan, VivoCity, 530101…"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-lg border border-rule bg-canvas px-3 py-2 text-sm text-ink placeholder:text-faint"
              />
              {/* Submit rather than search-as-you-type: Nominatim's usage
                  policy rules out a query per keystroke. */}
              <button
                type="submit"
                disabled={
                  query.trim().length < 2 || searchStatus === "searching"
                }
                className="rounded-lg border border-ink px-4 py-2 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {searchStatus === "searching" ? "Searching…" : "Search"}
              </button>
            </div>
          </form>

          <div aria-live="polite">
            {searchStatus === "error" && searchError ? (
              <p className="mt-3 text-sm text-muted">{searchError}</p>
            ) : null}

            {searchStatus === "done" && matches.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                Nothing in Singapore matched that. Try an estate, MRT station,
                mall, block number, or six-digit postcode.
              </p>
            ) : null}

            {matches.length > 0 ? (
              <ul className="mt-3 divide-y divide-rule border-t border-rule">
                {matches.map((match) => (
                  <li key={match.id}>
                    <button
                      type="button"
                      onClick={() => handleChooseMatch(match)}
                      className="w-full py-2.5 text-left hover:text-accent"
                    >
                      <span className="block text-sm font-medium text-ink">
                        {match.name}
                      </span>
                      {match.context ? (
                        <span className="mt-0.5 block text-xs text-faint">
                          {match.context}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleUseDevice}
            disabled={busy}
            className="mt-4 text-sm text-accent hover:underline disabled:opacity-60"
          >
            Use my current location instead
          </button>
        </div>
      ) : null}

      {/* Only meaningful once there are results to describe, since every
          option and count is derived from them. */}
      {places.length > 0 ? (
        <PlaceFilters
          places={places}
          filters={filters}
          onToggleCategory={(value) =>
            applyAndRepick({
              ...filters,
              categories: toggle(filters.categories, value),
            })
          }
          onToggleCuisine={(value) =>
            applyAndRepick({
              ...filters,
              cuisines: toggle(filters.cuisines, value),
            })
          }
          onClear={() => applyAndRepick(NO_FILTERS)}
          disabled={busy}
        />
      ) : null}

      <button
        type="button"
        onClick={handleEatWhat}
        disabled={busy}
        className="mt-8 w-full rounded-lg bg-brand px-6 py-4 text-lg font-medium text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {status === "locating"
          ? "Finding you…"
          : status === "searching"
            ? "Looking around…"
            : "Eat what?"}
      </button>

      {/* Announced to screen readers, since the result replaces itself in place. */}
      <div aria-live="polite" className="mt-8">
        {status === "error" && error ? (
          <p className="text-sm leading-relaxed text-muted">{error}</p>
        ) : null}

        {status === "ready" && !pick ? (
          <div className="rounded-xl border border-rule p-6">
            <p className="text-sm leading-relaxed text-muted">
              Nothing {formatBandFrom(band, origin ? originLabel(origin) : null)}{" "}
              matches that filter.
              {places.length > 0
                ? ` There ${places.length === 1 ? "is" : "are"} ${places.length} place${places.length === 1 ? "" : "s"} here without it.`
                : ""}
            </p>
            <button
              type="button"
              onClick={() => applyAndRepick(NO_FILTERS)}
              className="mt-4 rounded-lg border border-rule px-4 py-2 text-sm text-ink hover:border-ink"
            >
              Clear filters
            </button>
          </div>
        ) : null}

        {status === "ready" && pick ? (
          <div className="rounded-xl border border-rule bg-surface p-6">
            <p className="text-xs font-semibold tracking-[0.14em] text-faint uppercase">
              Go eat at
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
              {pick.name}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {[pick.category, ...pick.cuisines].join(" · ")} ·{" "}
              {formatDistance(pick.distanceMeters)} away
            </p>

            {/* OSM records opening hours for about a fifth of places, so most
                picks show nothing here. Absence means unknown, never closed,
                which is why there is no "hours unavailable" line. */}
            {formatOpeningHours(pick.openingHours) ? (
              <p className="mt-1 text-sm text-muted">
                {formatOpeningHours(pick.openingHours)}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
              <button
                type="button"
                onClick={handleReroll}
                className="rounded-lg border border-rule px-4 py-2 text-sm text-ink hover:border-ink"
              >
                Try another
              </button>
              {origin ? (
                <a
                  href={directionsUrl(pick, origin, band)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-accent hover:underline"
                >
                  {band.id === "walk"
                    ? "Walking directions"
                    : band.id === "car"
                      ? "Driving directions"
                      : "Transit directions"}
                </a>
              ) : null}
            </div>

            {/* The honest caveat, next to the thing it qualifies. Listings are
                crowd-sourced and a long-untouched one is the likeliest to have
                shut — which is the common complaint — so the age is shown and
                fixing it is one click away. */}
            <p className="mt-5 text-xs leading-relaxed text-faint">
              {pick.lastConfirmed
                ? `OpenStreetMap last confirmed this on ${pick.lastConfirmed}. `
                : ""}
              Closed or moved?{" "}
              <a
                href={osmUrl(pick)}
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                Fix it on OSM
              </a>{" "}
              and it will be gone from here at the next refresh.
            </p>

            <p className="mt-3 font-mono text-xs text-faint">
              picked from {pool.length}
              {hasFilters(filters) ? ` of ${places.length}` : ""} place
              {pool.length === 1 && !hasFilters(filters) ? "" : "s"}{" "}
              {formatBandFrom(band, origin ? originLabel(origin) : null)}
              {/* Only when the band was too dense to send whole, so the number
                  above is not mistaken for everything that is out there. */}
              {totalFound > places.length
                ? ` · sampled from ${totalFound} nearby`
                : ""}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
