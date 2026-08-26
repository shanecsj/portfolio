"use client";

import { useRef, useState } from "react";
import { formatDistance, mapsUrl } from "@/lib/eatwhat/format";
import type {
  ApiError,
  GeocodeResult,
  LocationMatch,
  NearbyPlacesResult,
  Place,
} from "@/lib/eatwhat/types";

/** Radius choices, in metres. Must stay inside the API's 200–5000 bounds. */
const RADIUS_OPTIONS = [500, 1000, 2000] as const;

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
  const [radius, setRadius] = useState<number>(1000);
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [places, setPlaces] = useState<Place[]>([]);
  const [pick, setPick] = useState<Place | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Manual location search.
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<LocationMatch[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [searchError, setSearchError] = useState<string | null>(null);
  const queryInput = useRef<HTMLInputElement>(null);

  const busy = status === "locating" || status === "searching";

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
  async function runLookup(from: Origin, withRadius: number) {
    setStatus("searching");
    setError(null);
    setPick(null);
    setPlaces([]);

    try {
      const params = new URLSearchParams({
        lat: String(from.lat),
        lon: String(from.lon),
        radius: String(withRadius),
      });
      const response = await fetch(`/api/eatwhat?${params}`);
      const body: NearbyPlacesResult | ApiError = await response.json();

      if (!response.ok) {
        setError("error" in body ? body.error : "The lookup failed.");
        setStatus("error");
        return;
      }

      const found = (body as NearbyPlacesResult).places;
      if (found.length === 0) {
        setError(
          `Nothing on the map within ${formatDistance(withRadius)} of ${originLabel(from)}. Try a wider radius, or a different spot.`,
        );
        setStatus("error");
        return;
      }

      setPlaces(found);
      setPick(pickRandom(found, null));
      setStatus("ready");
    } catch {
      setError("Could not reach the server. Check your connection and retry.");
      setStatus("error");
    }
  }

  /** Main button. Reuses a chosen origin; otherwise asks the device. */
  async function handleEatWhat() {
    if (origin) {
      await runLookup(origin, radius);
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
      await runLookup(next, radius);
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
      await runLookup(next, radius);
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
    await runLookup(next, radius);
  }

  function handleReroll() {
    if (places.length === 0) return;
    setPick((current) => pickRandom(places, current));
  }

  return (
    <div>
      <fieldset disabled={busy} className="mt-8">
        <legend className="text-xs font-semibold tracking-[0.14em] text-faint uppercase">
          Within
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {RADIUS_OPTIONS.map((option) => {
            const selected = option === radius;
            return (
              <label
                key={option}
                className={
                  selected
                    ? "cursor-pointer rounded-full border border-ink bg-ink px-4 py-1.5 text-sm text-canvas"
                    : "cursor-pointer rounded-full border border-rule px-4 py-1.5 text-sm text-muted hover:border-ink hover:text-ink"
                }
              >
                <input
                  type="radio"
                  name="radius"
                  value={option}
                  checked={selected}
                  onChange={() => setRadius(option)}
                  className="sr-only"
                />
                {formatDistance(option)}
              </label>
            );
          })}
        </div>
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
                placeholder="Bishan, VivoCity, Orchard Road…"
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
                Nothing in Singapore matched that. Try an estate, MRT
                station, mall, or postcode.
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

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
              <button
                type="button"
                onClick={handleReroll}
                className="rounded-lg border border-rule px-4 py-2 text-sm text-ink hover:border-ink"
              >
                Try another
              </button>
              <a
                href={mapsUrl(pick)}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-accent hover:underline"
              >
                Open in Maps
              </a>
            </div>

            <p className="mt-5 font-mono text-xs text-faint">
              picked from {places.length} place
              {places.length === 1 ? "" : "s"} within {formatDistance(radius)}
              {origin ? ` of ${originLabel(origin)}` : ""}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
