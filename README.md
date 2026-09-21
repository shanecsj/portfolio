# shanecsj.dev

Personal site and resume. Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # catches type errors; dev does not
npm run lint
```

## Where things live

| Path | What it is |
| --- | --- |
| `src/content/resume.ts` | **All resume content.** Editing the resume means editing only this file. |
| `src/config/site.ts` | Name, tagline, description, canonical URL (drives SEO metadata). |
| `src/config/nav.ts` | Nav items. Also drives `sitemap.xml`. |
| `src/app/page.tsx` | Resume page — renders `resume.ts`, holds no content of its own. |
| `src/app/layout.tsx` | Shared shell: font, metadata, header, footer. |
| `src/app/globals.css` | Theme tokens. Colours swap on `prefers-color-scheme`. |
| `src/app/hello/` | Template for a new page. Copy it, or delete it. |
| `src/app/eatwhat/` | "Eat what?" — randomises a food place near you or any searched location. See below. |

Sections with an empty array in `resume.ts` are skipped by the page automatically.

## Adding a feature at /newfeature

1. `cp -r src/app/hello src/app/newfeature` and edit it.
2. Add `{ href: "/newfeature", label: "New feature" }` to `src/config/nav.ts`.

Needs a backend? Add `src/app/api/newfeature/route.ts` exporting `GET`/`POST`. It runs
serverless on Vercel — no separate service to deploy.

Needs persistence? Attach Vercel Postgres or Vercel KV from the Vercel dashboard.

## /eatwhat

Looks up food places around a point and picks one at random. The point is your
device's location, or any place you search for by name.

| Path | What it is |
| --- | --- |
| `src/app/eatwhat/page.tsx` | Server-rendered shell: heading, blurb, data-source note. |
| `src/components/eatwhat/eat-what.tsx` | The only client code — geolocation, search, fetch, randomising. |
| `src/app/api/eatwhat/route.ts` | `GET ?lat=&lon=&radius=` → `{ places, center, radiusMeters }`. |
| `src/app/api/eatwhat/geocode/route.ts` | `GET ?q=` → `{ matches }`. Turns a typed place name into coordinates. |
| `src/lib/eatwhat/overpass.ts` | Food lookup. **Swap this file to change providers.** |
| `src/lib/eatwhat/geocode.ts` | Location search. Merges the two geocoders below. |
| `src/lib/eatwhat/nominatim.ts` | Geocoder: OpenStreetMap. Good at colloquial names. |
| `src/lib/eatwhat/onemap.ts` | Geocoder: Singapore Land Authority. Good at addresses. |
| `src/components/eatwhat/place-filters.tsx` | The two rows of chips that narrow the pick. |
| `src/lib/eatwhat/distance.ts` | Haversine, shared by the food sort and the geocoder merge. |
| `src/lib/eatwhat/filter.ts` | Filter logic: options, counts, and applying a selection. |
| `src/lib/eatwhat/travel.ts` | The four travel modes and the distance band each means. |
| `src/lib/eatwhat/cuisine.ts` | Folds OSM's 1,911 cuisine values into ~20 filterable groups. |
| `src/lib/eatwhat/types.ts` | `Place` and `LocationMatch` — the shapes providers normalise into. |
| `src/lib/eatwhat/user-agent.ts` | Sent to both OSM services. Overpass 406s without it. |

### Where the location comes from

The component holds one `Origin`: either `{ kind: "device" }` from the browser's
geolocation, or `{ kind: "named" }` from a search. Both feed the same lookup, so
the food side never knows or cares which was used.

Searching is offered three ways, because geolocation fails more often than you'd
think — blocked permission, a desktop with no GPS, or simply wanting to plan
around somewhere you aren't:

- automatically, when geolocation is denied or unavailable (the panel opens itself);
- via "Use another place", always visible;
- via "Change", once an origin is set.

Search is confined to Singapore (`COUNTRY_CODES` in `nominatim.ts` — widen it to
`"sg,my"` and so on). Unrestricted, Nominatim ranks globally by importance, so
"Orchard Road" returned English villages ahead of the Singapore one.

Results are still shown as a list to pick from rather than auto-selecting the top
hit, since one query can match several real places. Rows naming the same place at
the same address are collapsed first — a mall mapped as a relation plus two nodes
would otherwise appear three times, identically.

### Why two geocoders

`geocode.ts` queries OneMap and Nominatim in parallel and interleaves the results.
They fail in opposite directions, which is the entire point:

| Query | Nominatim | OneMap |
| --- | --- | --- |
| `530101` | nothing | 101 Hougang Avenue 1 |
| `Kopitiam Bedok` | found it | nothing |
| `Jewel` | 4 distinct places | 23 rows, all one estate |

OneMap indexes registered premises, so it owns postcodes, HDB blocks, malls and
MRT stations. OSM indexes whatever a mapper walked past, so it owns colloquial
names and ranks by prominence — which is why Nominatim leads the interleave.
Postcodes need no special case: Nominatim returns nothing for them, so OneMap
fills the list on its own.

Duplicates across the two are dropped when the names match *and* the coordinates
are within `DUPLICATE_RADIUS_M` (250 m). Both conditions are needed — there is a
Kopitiam in most estates, and those are genuinely different destinations.

Either provider may fail without failing the search; the route only 502s when
both are unreachable.

### How far to go

The first choice is not a radius but a travel mode — Walkable, By bus, By MRT,
By car — because a distance in metres is not how anyone decides where lunch is.
Each mode is a **band**, not a disc, so it excludes what the easier mode already
covers:

| Mode | Band | Maps `travelmode` |
| --- | --- | --- |
| Walkable | 0 – 300 m | `walking` |
| By bus | 300 – 800 m | `transit` |
| By MRT | 800 m – 1.5 km | `transit` |
| By car | 1.5 – 3 km | `driving` |

Banding is the point. As plain discs, "By car" would be "everything walkable,
plus more", and the nearest places would dominate every pick — choosing to drive
and being sent to the cafe 200 m away is a non-answer. The bands are deliberately
tight; Singapore is dense enough that 3 km is already a ten-minute drive.

Be honest about what this models. A radius is a crude proxy for a bus or train
journey, which really means "near a stop", not "within N metres". The label names
the mode that makes the distance reasonable; the UI spells out the actual band
underneath rather than implying a routed journey. Real transit isochrones would
be a separate feature.

The result links to Google Maps **directions** by the chosen mode, from the
search origin, rather than to a search pin — picking "By MRT" is a statement
about how you intend to get there, so the link honours it.

### Sampling dense areas

`MAX_RESULTS` (150) is applied here, not by Overpass. `out center 80` used to do
it, but Overpass applies a limit in its own order — roughly element id, so by
when a place was mapped — which is a bias rather than a sample, and it was
already biting before any of this: Orchard within 500 m holds 142 places and the
old code kept an arbitrary 80.

So the query is now unlimited and the trim happens where distance is known. The
worst case measured, Orchard within 3 km, is 2,663 elements and 912 KB, which
Overpass answers in about 3.5s; only the trimmed set crosses the wire, at roughly
50 KB.

The trim is a **uniform random sample, not the nearest N**. For a band those are
very different: the 1.5–3 km ring around Orchard holds thousands, and its nearest
150 all sit within metres of the 1.5 km floor, so "nearest" would collapse the
band back to its inner edge. When sampling happens the result line says
`sampled from 2,238 nearby`, so the count above it is not mistaken for everything
out there.

### Narrowing the pick

Two rows of chips — type (the OSM `amenity`) and cuisine — filter the pool the
randomiser draws from. Both run in the browser over the places already fetched,
so refining costs no Overpass slot and is as instant as a reroll. Within a row
any selection matches; across rows both must.

Options are derived from the results rather than hardcoded, which matters for
three reasons: a chip never offers something the neighbourhood cannot deliver,
the counts expose how thin the data is before you trust it, and the list follows
whatever is around. A selection that stops matching is still rendered, showing
0, so a filter carried over from a previous search can never be applied but
invisible.

**Cuisine is the unreliable half, by nature.** OSM tags it on about 44% of
restaurants, 49% of cafes and 4.8% of food courts — measured at 50% across a
240-place live sample — so filtering by it always hides real matches. The UI
states the tagged share (`tagged on 34 of 80`) instead of pretending otherwise.
Type has no such problem: it is what the Overpass query selects on, so coverage
is 100% by construction.

The raw tag is unusable as a filter, which is what `cuisine.ts` exists for. The
regional extract carries 1,911 distinct values whose top 50 cover only 81%, and
they mix nationality (`chinese`), dish (`burger`), venue (`coffee_shop`), drink
(`bubble_tea`) and the merely vague (`local`, `asian`). They are also
semicolon-separated lists, so the useful unit is the atom: splitting the top 250
values gives 111 atoms covering 99.6%, which is what the group map is built
from. On the live sample it grouped 97% of tagged places. Anything unrecognised
or too vague produces no group — the place stays in the pool and is only ever
excluded by an active filter, never hidden by one it should have matched.

Adding a cuisine value means finding the group it belongs to in `GROUPS`.
Values judged too vague to filter on are listed in `TOO_VAGUE` rather than
simply omitted, so the omission reads as a decision.

### Data sources

All three are free and cost nothing per call, so the feature works on a fresh
clone with nothing configured:

- [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API) for the food lookup.
- [Nominatim](https://nominatim.org/) for location search.
- [OneMap](https://www.onemap.gov.sg/apidocs/) for location search.

The trade-off is crowd-sourced coverage on the OSM side: no ratings, no photos,
opening hours usually missing, and both OSM services are rate-limited (Overpass
allows two concurrent slots per IP; Nominatim asks for at most one request per
second, which is why the search box submits rather than querying per keystroke).

#### Surviving Overpass

Overpass is the flakiest part of the feature, and "The places service is busy"
almost always traces back to its two-slots-per-IP limit. Four things in
`overpass.ts` exist purely to absorb that, all of them worth knowing before
touching the timeouts:

- **It queues rather than refuses.** Passing the slot limit makes Overpass hold
  the connection until a slot frees, so a slow answer is usually an answer on
  its way. The per-endpoint timeout was once 8s, which measured 9.2s on a
  queued request that then succeeded — it was discarding results it had already
  waited most of the way for. The primary now gets 12s.
- **Results are cached** for 30 minutes, keyed on the centre rounded to ~11 m
  plus the radius, with distances recomputed from the caller's true position on
  a hit. Repeat lookups cost no rate-limit slot at all.
- **429/503/504 trigger a backoff and retry** of the primary, not a fallthrough
  to the other endpoints. `lz4.` and `z.` are the same project behind the same
  per-IP limit, so after a 429 they only time out — that path used to cost 14s
  to learn nothing.
- **The whole lookup is bounded** by `TOTAL_BUDGET_MS` (25s, inside the route's
  30s `maxDuration`), and each attempt is clipped to what is left of it, so
  retries cannot get the function killed mid-flight.

`overpass.kumi.systems` was removed from `ENDPOINTS`: it is now a CNAME to
`overpass.private.coffee`, which accepts the TCP connection and then never
answers. `overpass.osm.ch` stays out for a subtler reason — it is fast and
returns a cheerful 200, but holds Swiss data only, so a Singapore query gets
zero elements, which reads as "nothing nearby" rather than as a failure to fall
through.

Hammering Overpass from one IP gets that IP temporarily blocked at the network
level (TCP 443 stops opening). If every lookup starts failing with
`TypeError: fetch failed` while other sites work, that is what happened; it
clears on its own.

Google Places was considered for search and rejected on cost risk, not quality.
Its caps are weaker than they look: billing budgets only *alert*, Google's native
hard spend caps do not yet cover Maps, and the Places API (New) documents only
per-minute limits — 60/min sustained still reaches roughly $240/day. Bounding it
properly would mean a KV-backed daily counter, a query cache and per-IP limiting,
which is a lot of moving parts for a portfolio site. Revisit if coverage ever
becomes the binding constraint; `searchLocations` is the single swap point.

To move the food lookup to Google Places or Foursquare, rewrite `fetchNearbyPlaces`
in `overpass.ts` to return `Place[]`; nothing else needs to change. Location search
swaps the same way via `searchLocations` in `geocode.ts`. Put any key in a Vercel
environment variable, never in the repo.

#### OneMap credentials (optional)

OneMap still answers unauthenticated, returning results with an
`"Authentication token missing"` warning attached — which is why nothing is
required to run this locally. That grace period is plainly closing, so set these
in Vercel from a free account at [onemap.gov.sg](https://www.onemap.gov.sg/):

```
ONEMAP_EMAIL=you@example.com
ONEMAP_PASSWORD=...
```

`onemap.ts` mints and caches a bearer token per serverless instance and refreshes
it a minute before expiry. If the credentials are absent or the refresh fails it
logs and falls back to searching unauthenticated — a degraded search beats none.

Knobs worth turning:

- Travel modes and their bands — `TRAVEL_BANDS` in `travel.ts` (API allows 100–5000 m).
- Which places count as food — `AMENITIES` in `overpass.ts`.
- How many places are sampled and sent — `MAX_RESULTS` in `overpass.ts`.
- Lookup cache lifetime and size — `CACHE_TTL_MS` / `CACHE_MAX_ENTRIES` in `overpass.ts`.
- How long to wait on a queued Overpass — `PRIMARY_TIMEOUT_MS` in `overpass.ts`.
- Number of search matches offered — `MAX_MATCHES` in `geocode.ts`.
- How aggressively duplicate matches collapse — `DUPLICATE_RADIUS_M` in `geocode.ts`.
- Cuisine groups, and which OSM values feed them — `GROUPS` in `cuisine.ts`.
- Countries the search covers — `COUNTRY_CODES` in `nominatim.ts` (OneMap is
  Singapore-only by nature, so widening this leaves it contributing nothing).

The whole list is sent to the browser and the random pick happens there, so
"Try another" is instant and doesn't re-hit the upstream API.


## Deploying

Pushes to `main` deploy to production automatically; every other branch gets a preview URL.

**This repo is public — never commit secrets.** API keys belong in Vercel project
environment variables, not in the repo or in `next.config.ts`.
