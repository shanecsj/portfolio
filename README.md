# shanecsj.me

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

Sections with an empty array in `resume.ts` are skipped by the page automatically.

## Adding a feature at /newfeature

1. `cp -r src/app/hello src/app/newfeature` and edit it.
2. Add `{ href: "/newfeature", label: "New feature" }` to `src/config/nav.ts`.

Needs a backend? Add `src/app/api/newfeature/route.ts` exporting `GET`/`POST`. It runs
serverless on Vercel — no separate service to deploy.

Needs persistence? Attach Vercel Postgres or Vercel KV from the Vercel dashboard.

## Deploying

Pushes to `main` deploy to production automatically; every other branch gets a preview URL.

**This repo is public — never commit secrets.** API keys belong in Vercel project
environment variables, not in the repo or in `next.config.ts`.
