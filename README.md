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
| `src/app/eatwhere/` | "Eat where?" — randomises a nearby food place. See below. |

Sections with an empty array in `resume.ts` are skipped by the page automatically.

## Adding a feature at /newfeature

1. `cp -r src/app/hello src/app/newfeature` and edit it.
2. Add `{ href: "/newfeature", label: "New feature" }` to `src/config/nav.ts`.

Needs a backend? Add `src/app/api/newfeature/route.ts` exporting `GET`/`POST`. It runs
serverless on Vercel — no separate service to deploy.

Needs persistence? Attach Vercel Postgres or Vercel KV from the Vercel dashboard.

## /eatwhere

Asks the browser for your location, looks up food places around you, and picks one
at random.

| Path | What it is |
| --- | --- |
| `src/app/eatwhere/page.tsx` | Server-rendered shell: heading, blurb, data-source note. |
| `src/components/eatwhere/eat-where.tsx` | The only client code — geolocation, fetch, randomising. |
| `src/app/api/eatwhere/route.ts` | `GET ?lat=&lon=&radius=` → `{ places, center, radiusMeters }`. |
| `src/lib/eatwhere/overpass.ts` | Data source. **Swap this file to change providers.** |
| `src/lib/eatwhere/types.ts` | The `Place` shape every provider normalises into. |

Data comes from OpenStreetMap via the [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)
— free, no API key, so the feature works on a fresh clone with nothing configured.
The trade-off is crowd-sourced coverage: no ratings, no photos, opening hours usually
missing, and the public endpoints are rate-limited.

To move to Google Places or Foursquare, rewrite `fetchNearbyPlaces` in
`overpass.ts` to return `Place[]`; nothing else needs to change. Put the key in a
Vercel environment variable, never in the repo.

Knobs worth turning:

- Radius choices — `RADIUS_OPTIONS` in `eat-where.tsx` (API allows 200–5000 m).
- Which places count as food — `AMENITIES` in `overpass.ts`.
- Result cap — `MAX_RESULTS` in `overpass.ts`.

The whole list is sent to the browser and the random pick happens there, so
"Try another" is instant and doesn't re-hit the upstream API.

## Deploying

Pushes to `main` deploy to production automatically; every other branch gets a preview URL.

**This repo is public — never commit secrets.** API keys belong in Vercel project
environment variables, not in the repo or in `next.config.ts`.
