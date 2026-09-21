import type { LocationMatch } from "./types";

/**
 * Place-name search via OneMap, the Singapore Land Authority's own geocoder.
 *
 * The counterpart to `nominatim.ts`, and the reason the two run together: they
 * fail in opposite directions. OneMap is authoritative on anything with an
 * address — postcodes, HDB blocks, malls, MRT stations — where OSM is simply
 * blank ("530101" returns nothing at all from Nominatim). OSM in turn carries
 * the colloquial names of small places that were never a registered premises.
 * `geocode.ts` merges both so a search hits whichever index knows the answer.
 *
 * Free, no billing account, no per-call cost.
 */

const SEARCH_ENDPOINT = "https://www.onemap.gov.sg/api/common/elastic/search";
const TOKEN_ENDPOINT = "https://www.onemap.gov.sg/api/auth/post/getToken";

/** A single indexed lookup, so this is generous rather than tight. */
const TIMEOUT_MS = 6_000;

/**
 * OneMap pages at ten results, and page one is all we ask for. The merge takes
 * roughly half its final list from here, so ten is already more than enough
 * headroom for the deduplication downstream.
 */
const RESULTS_PER_PAGE = 10;

/**
 * Renew slightly before the token actually lapses, so a request that is already
 * in flight when the clock runs out doesn't get rejected mid-search.
 */
const TOKEN_REFRESH_MARGIN_MS = 60_000;

/**
 * OneMap returns everything in capitals, so "is this word uppercase?" carries
 * no signal and the acronyms in Singapore building names have to be listed.
 * Pragmatic rather than exhaustive — a miss costs a slightly odd-looking
 * "Mrt", which is cosmetic, and the bracket rule below catches the rest.
 *
 * Deliberately absent: ST, which is Saint about as often as it is a company.
 */
const KEEP_UPPERCASE = new Set([
  "MRT", "LRT", "BTO", "HDB", "JTC", "URA", "SLA", "PSA", "NTUC", "CPF",
  "ITE", "NUS", "NTU", "SMU", "SIT", "SUTD", "CBD", "CC", "RC", "NCS",
  "SAF", "HQ", "JB", "AMK", "TPY", "II", "III", "IV",
]);

/**
 * A short all-letter word in brackets is an official abbreviation rather than
 * a word — "ENABLING SERVICES HUB (ESH)". Generalises the list above to the
 * long tail of agency and scheme acronyms without having to enumerate them.
 */
const BRACKETED_ACRONYM = /^\(([A-Za-z]{2,5})\)$/;

/** Fields OneMap fills with this literal rather than leaving empty. */
const NIL = "NIL";

type OneMapResult = {
  SEARCHVAL: string;
  BLK_NO: string;
  ROAD_NAME: string;
  BUILDING: string;
  ADDRESS: string;
  POSTAL: string;
  LATITUDE: string;
  LONGITUDE: string;
};

type OneMapSearchBody = {
  found?: number;
  results?: OneMapResult[];
  /** Present, with results still attached, when the token is absent or stale. */
  error?: string;
};

type CachedToken = { value: string; expiresAt: number };

/**
 * Module-scope so a warm serverless instance reuses one token across requests.
 * Each instance mints its own, which is fine — OneMap allows concurrent tokens
 * and the alternative is shared state this site does not otherwise need.
 */
let cachedToken: CachedToken | null = null;
let tokenInFlight: Promise<string | null> | null = null;

/** Whether a field carries a real value rather than OneMap's "NIL" filler. */
function present(value: string | undefined): value is string {
  return typeof value === "string" && value.trim() !== "" && value !== NIL;
}

/** "HARBOURFRONT WALK" -> "Harbourfront Walk", leaving "(S1)" and "MRT" alone. */
function titleCase(value: string): string {
  return value
    .split(" ")
    .map((word) => {
      // Anything with a digit is a block, a unit or a line code — as-is.
      if (/\d/.test(word)) return word;
      if (BRACKETED_ACRONYM.test(word)) return word.toUpperCase();
      const letters = word.replace(/[^A-Za-z]/g, "");
      if (KEEP_UPPERCASE.has(letters.toUpperCase())) return word;
      return word.replace(
        /[A-Za-z]+/g,
        (run) => run.charAt(0).toUpperCase() + run.slice(1).toLowerCase(),
      );
    })
    .join(" ");
}

function toMatch(result: OneMapResult): LocationMatch | null {
  const lat = Number(result.LATITUDE);
  const lon = Number(result.LONGITUDE);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const street = [result.BLK_NO, result.ROAD_NAME]
    .filter((part) => present(part))
    .join(" ");

  // Most rows are a named premises, but a bare postcode resolves to an address
  // with no building on it. Leading with the street then beats SEARCHVAL,
  // which in that case is the whole address line, postcode and all.
  const heading = present(result.BUILDING)
    ? result.BUILDING
    : present(street)
      ? street
      : result.SEARCHVAL;
  if (!present(heading)) return null;

  const name = titleCase(heading);

  // The second line exists to tell same-named results apart — several blocks
  // in one estate share a building name — so it carries the street address.
  // Omitted when the heading already is that address, as above.
  const context = [
    present(street) && titleCase(street) !== name ? titleCase(street) : null,
    present(result.POSTAL) ? `S${result.POSTAL}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");

  return {
    // Namespaced because the merged list carries ids from both providers and
    // they are used as React keys.
    id: `onemap:${result.POSTAL}:${result.LATITUDE},${result.LONGITUDE}`,
    name,
    context,
    lat,
    lon,
  };
}

/**
 * A bearer token, or null to search unauthenticated.
 *
 * Credentials are optional by design: OneMap still answers without a token,
 * appending a warning to the body rather than refusing, so a fresh clone and a
 * preview deployment both work with nothing configured. That grace period is
 * plainly on its way out though — set ONEMAP_EMAIL and ONEMAP_PASSWORD in
 * production, from a free account at onemap.gov.sg.
 */
async function getToken(): Promise<string | null> {
  const email = process.env.ONEMAP_EMAIL;
  const password = process.env.ONEMAP_PASSWORD;
  if (!email || !password) return null;

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - TOKEN_REFRESH_MARGIN_MS > now) {
    return cachedToken.value;
  }

  // Collapse concurrent refreshes: a cold instance handling two searches at
  // once should mint one token, not race itself for two.
  tokenInFlight ??= (async () => {
    try {
      const response = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`OneMap token endpoint responded ${response.status}`);
      }

      const body = (await response.json()) as {
        access_token?: string;
        /** Unix seconds. */
        expiry_timestamp?: string | number;
      };
      if (!body.access_token) throw new Error("OneMap returned no access_token");

      cachedToken = {
        value: body.access_token,
        expiresAt: Number(body.expiry_timestamp) * 1000,
      };
      return cachedToken.value;
    } catch (error) {
      // Never fatal. An unauthenticated search still returns results today,
      // and a degraded search beats no search at all.
      console.error("[eatwhat] OneMap token refresh failed", error);
      cachedToken = null;
      return null;
    } finally {
      tokenInFlight = null;
    }
  })();

  return tokenInFlight;
}

/**
 * Locations matching a free-text query, in OneMap's own relevance order.
 * Returns an empty array when nothing matches. Throws only if OneMap is
 * unreachable — `geocode.ts` tolerates that as long as the other provider
 * answered.
 */
export async function searchOneMap(query: string): Promise<LocationMatch[]> {
  const token = await getToken();

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);

  try {
    const params = new URLSearchParams({
      searchVal: query,
      returnGeom: "Y",
      getAddrDetails: "Y",
      pageNum: "1",
    });
    const response = await fetch(`${SEARCH_ENDPOINT}?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`OneMap responded ${response.status}`);
    }

    const body = (await response.json()) as OneMapSearchBody;
    if (body.error) {
      // Results are still attached during the grace period, so this is a
      // warning to act on rather than a failure to propagate.
      console.warn(`[eatwhat] OneMap search unauthenticated: ${body.error}`);
    }

    return (body.results ?? [])
      .slice(0, RESULTS_PER_PAGE)
      .map(toMatch)
      .filter((match): match is LocationMatch => match !== null);
  } catch (error) {
    throw timedOut
      ? new Error(`OneMap did not answer within ${TIMEOUT_MS}ms`)
      : error;
  } finally {
    clearTimeout(timer);
  }
}
