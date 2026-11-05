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
| `src/app/mj/` | Unlisted mahjong ledger. Not in the nav or sitemap. See below. |

Sections with an empty array in `resume.ts` are skipped by the page automatically.

## Adding a feature at /newfeature

1. `cp -r src/app/hello src/app/newfeature` and edit it.
2. Add `{ href: "/newfeature", label: "New feature" }` to `src/config/nav.ts`.

Needs a backend? Add `src/app/api/newfeature/route.ts` exporting `GET`/`POST`. It runs
serverless on Vercel — no separate service to deploy.

Needs persistence? Attach Vercel Postgres or Vercel KV from the Vercel dashboard.

## /mj

An unlisted mahjong ledger. Anyone with the link can view the leaderboard
and session history. Only the admin can enter results. The page is
deliberately absent from `NAV_ITEMS` (so from the header and sitemap), is
marked `noindex` in metadata and via an `X-Robots-Tag` header, and is *not*
named in `robots.txt`, which is public.

Each session stores every player's net result in integer cents. The entry form
shows a live total that must reach $0.00. An unbalanced session is rejected
unless you tick "Save anyway"; it is then flagged ⚠ everywhere it appears.

| Path | What it is |
| --- | --- |
| `src/app/mj/page.tsx` | Public board: leaderboard and session history. |
| `src/app/mj/zhahu/page.tsx` | 诈胡 (zha hu, false win) count per player. Admin gets −/+ buttons. |
| `src/app/mj/admin/page.tsx` | Login, or new-session form + player roster. |
| `src/app/mj/admin/sessions/[id]/page.tsx` | Edit or delete one session. |
| `src/app/mj/admin/actions.ts` | Server actions. Each re-checks the admin cookie. |
| `src/components/mj/session-form.tsx` | Entry form with the live zero-sum check. |
| `src/lib/mj/auth.ts` | HMAC-signed admin cookie. |
| `src/lib/mj/db.ts` | Queries. |
| `src/lib/mj/sql.ts` | Driver: Neon in production, PGlite for local testing. |
| `src/lib/mj/stats.ts` | Standings (pure). |
| `scripts/mj-schema.sql` | Schema. Run once in the Neon SQL editor. |

Setup:

1. Vercel dashboard → Storage → add **Neon** to the project. This sets `DATABASE_URL`.
2. Run `scripts/mj-schema.sql` in the Neon SQL editor.
3. Add env vars `MJ_ADMIN_PASSWORD` and `MJ_SESSION_SECRET`
   (`openssl rand -base64 48`). Changing the secret signs everyone out.

Local testing without a real database: set `DATABASE_URL=pglite:/some/temp/dir`
in `.env.local`. That runs an in-process Postgres stored in that folder and
applies the schema automatically. Delete the folder to start over.

## Deploying

Pushes to `main` deploy to production automatically; every other branch gets a preview URL.

**This repo is public — never commit secrets.** API keys belong in Vercel project
environment variables, not in the repo or in `next.config.ts`.
