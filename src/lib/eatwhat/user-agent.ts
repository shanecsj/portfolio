/**
 * Sent to Nominatim, whose usage policy asks that the agent identify who to
 * contact about unusual traffic.
 *
 * Overpass wants one too — it answers 406 without it — but is no longer called
 * at request time, so its copy lives in `scripts/build-places.mjs`, which is a
 * standalone Node script and cannot import from here.
 */
export const USER_AGENT = "shanecsj.dev/eatwhat (https://shanecsj.dev)";
