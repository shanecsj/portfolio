"use client";

import { useState } from "react";
import { formatDistance, mapsUrl } from "@/lib/eatwhere/format";
import type { ApiError, NearbyPlacesResult, Place } from "@/lib/eatwhere/types";

/** Radius choices, in metres. Must stay inside the API's 200–5000 bounds. */
const RADIUS_OPTIONS = [500, 1000, 2000] as const;

type Status = "idle" | "locating" | "searching" | "ready" | "error";

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
  if (typeof GeolocationPositionError !== "undefined" && error instanceof GeolocationPositionError) {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return "Location permission denied. Allow it in your browser's site settings and try again.";
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

export function EatWhere() {
  const [radius, setRadius] = useState<number>(1000);
  const [status, setStatus] = useState<Status>("idle");
  const [places, setPlaces] = useState<Place[]>([]);
  const [pick, setPick] = useState<Place | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = status === "locating" || status === "searching";

  async function handleEatWhere() {
    setError(null);
    setPick(null);
    setPlaces([]);

    let position: GeolocationPosition;
    setStatus("locating");
    try {
      position = await getPosition();
    } catch (locationError) {
      setError(geolocationMessage(locationError));
      setStatus("error");
      return;
    }

    setStatus("searching");
    try {
      const { latitude, longitude } = position.coords;
      const query = new URLSearchParams({
        lat: String(latitude),
        lon: String(longitude),
        radius: String(radius),
      });
      const response = await fetch(`/api/eatwhere?${query}`);
      const body: NearbyPlacesResult | ApiError = await response.json();

      if (!response.ok) {
        setError("error" in body ? body.error : "The lookup failed.");
        setStatus("error");
        return;
      }

      const found = (body as NearbyPlacesResult).places;
      if (found.length === 0) {
        setError(
          `Nothing on the map within ${formatDistance(radius)}. Try a wider radius.`,
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

      <button
        type="button"
        onClick={handleEatWhere}
        disabled={busy}
        className="mt-8 w-full rounded-lg bg-brand px-6 py-4 text-lg font-medium text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {status === "locating"
          ? "Finding you…"
          : status === "searching"
            ? "Looking around…"
            : "Eat where?"}
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
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
