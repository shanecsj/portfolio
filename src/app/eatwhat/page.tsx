import type { Metadata } from "next";
import { EatWhat } from "@/components/eatwhat/eat-what";

export const metadata: Metadata = {
  title: "Eat what?",
  description:
    "Can't decide where to eat? Pick a radius, use your location or search for one, and get a random food place nearby.",
  alternates: { canonical: "/eatwhat" },
};

/**
 * Server component shell. Everything interactive — geolocation, the fetch, the
 * randomising — lives in <EatWhat />, which is the only client bundle here.
 */
export default function EatWhatPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">
        Eat what?
      </h1>
      <p className="mt-3 text-[0.95rem] leading-relaxed text-muted">
        For when nobody in the group will commit. Share your location — or
        search for any place instead — and the site picks one nearby spot at
        random.
      </p>

      <EatWhat />

      <p className="mt-12 border-t border-rule pt-6 text-xs leading-relaxed text-faint">
        Places come from OpenStreetMap, via Overpass for the food lookup and
        Nominatim for location search. Your coordinates are sent to this site
        to run the lookup and are never stored. Listings are crowd-sourced, so
        opening hours are usually missing and the occasional entry has closed
        down — check before you walk.
      </p>
    </div>
  );
}
