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
| `src/lib/eatwhat/nominatim.ts` | Location search. Swap independently of the food lookup. |
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

### Data sources

Both are OpenStreetMap and both are keyless, so the feature works on a fresh clone
with nothing configured:

- [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API) for the food lookup.
- [Nominatim](https://nominatim.org/) for location search.

The trade-off is crowd-sourced coverage: no ratings, no photos, opening hours
usually missing, and both services are rate-limited (Overpass allows two
concurrent slots per IP; Nominatim asks for at most one request per second, which
is why the search box submits rather than querying per keystroke).

To move to Google Places or Foursquare, rewrite `fetchNearbyPlaces` in
`overpass.ts` to return `Place[]`; nothing else needs to change. Location search
swaps the same way via `searchLocations` in `nominatim.ts`. Put any key in a
Vercel environment variable, never in the repo.

Knobs worth turning:

- Radius choices — `RADIUS_OPTIONS` in `eat-what.tsx` (API allows 200–5000 m).
- Which places count as food — `AMENITIES` in `overpass.ts`.
- Result cap — `MAX_RESULTS` in `overpass.ts`.
- Number of search matches offered — `MAX_MATCHES` in `nominatim.ts`.
- Countries the search covers — `COUNTRY_CODES` in `nominatim.ts`.

The whole list is sent to the browser and the random pick happens there, so
"Try another" is instant and doesn't re-hit the upstream API.


## Deploying

Pushes to `main` deploy to production automatically; every other branch gets a preview URL.

**This repo is public — never commit secrets.** API keys belong in Vercel project
environment variables, not in the repo or in `next.config.ts`.
