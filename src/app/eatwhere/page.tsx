import type { Metadata } from "next";
import { EatWhere } from "@/components/eatwhere/eat-where";

export const metadata: Metadata = {
  title: "Eat where?",
  description:
    "Can't decide where to eat? Pick a radius, share your location, and get one random food place nearby.",
  alternates: { canonical: "/eatwhere" },
};

/**
 * Server component shell. Everything interactive — geolocation, the fetch, the
 * randomising — lives in <EatWhere />, which is the only client bundle here.
 */
export default function EatWherePage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">
        Eat where?
      </h1>
      <p className="mt-3 text-[0.95rem] leading-relaxed text-muted">
        For when nobody in the group will commit. Your browser asks for your
        location, the site looks up food places around you, and picks one at
        random.
      </p>

      <EatWhere />

      <p className="mt-12 border-t border-rule pt-6 text-xs leading-relaxed text-faint">
        Places come from OpenStreetMap via the Overpass API. Your coordinates
        are sent to this site to run the lookup and are never stored. Listings
        are crowd-sourced, so opening hours are usually missing and the
        occasional entry has closed down — check before you walk.
      </p>
    </div>
  );
}
