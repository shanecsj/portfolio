/**
 * Folds OpenStreetMap's `cuisine` tag into a short list of filterable groups.
 *
 * The raw tag is not usable as a filter. Measured on the Malaysia/Singapore/
 * Brunei extract it carries 1,911 distinct values whose top 50 cover only 81%,
 * and they mix several orthogonal ideas at once: nationality ("chinese"), dish
 * ("burger", "noodle"), venue ("coffee_shop", "steak_house"), drink
 * ("bubble_tea") and the merely vague ("local", "regional", "asian"). Values
 * are also semicolon-separated lists — "malaysian;chicken;burger" — so the
 * useful unit is the individual atom, not the tag.
 *
 * Splitting the top 250 values into atoms yields 111 of them covering 99.6% of
 * tagged places, which is what the map below is built from. Anything it does
 * not recognise, and anything too vague to filter on, produces no group: the
 * place stays in the pool and is only ever excluded by an active filter, never
 * hidden by one it should have matched.
 *
 * The bigger caveat belongs to the caller. Cuisine is tagged on roughly 44% of
 * restaurants, 49% of cafes and just 4.8% of food courts, so a cuisine filter
 * always hides real matches. The UI states the tagged share rather than
 * pretending otherwise.
 */

/**
 * Atom to display group. Written out per group rather than as one flat object
 * so that adding a value means finding the group it belongs to and nothing
 * else. Frequencies in the comments are from the regional extract and are what
 * justified each group existing at all.
 */
const GROUPS: Record<string, readonly string[]> = {
  // 2,903 — much the largest single cuisine in the region.
  Chinese: [
    "chinese", "cantonese", "dim_sum", "hotpot", "hot_pot", "steamboat",
    "hongkong", "hong_kong", "stir_fry", "congee", "dumpling", "teochew",
    "hokkien", "szechuan", "sichuan",
  ],
  // 2,201 + 189 + 126. "padang" is the Indonesian rice-and-sides style.
  "Malay & Indonesian": [
    "malaysian", "malay", "indonesian", "satay", "padang", "nasi_lemak",
  ],
  // "mamak" and "nasi_kandar" are Indian-Muslim, so they sit here rather than
  // under Malay, which is where their Malaysian setting might suggest.
  Indian: [
    "indian", "mamak", "nasi_kandar", "pakistani", "sri_lankan", "curry",
    "biryani", "tandoori", "north_indian", "south_indian",
  ],
  Japanese: [
    "japanese", "sushi", "ramen", "teppanyaki", "beef_bowl", "udon",
    "donburi", "izakaya", "yakitori", "tempura",
  ],
  Korean: ["korean", "korean_bbq"],
  Thai: ["thai"],
  Vietnamese: ["vietnamese", "pho"],
  // Catches the ones with nowhere better to go, including the vague but very
  // common bare "asian" (478).
  "Other Asian": [
    "asian", "taiwanese", "filipino", "burmese", "cambodian", "mongolian",
  ],
  // Hainanese chicken rice and Peranakan cooking are local rather than
  // imported, so they land here rather than under Chinese.
  Local: ["local", "regional", "singaporean", "chicken_rice", "peranakan"],
  Western: [
    "western", "american", "european", "steak_house", "grill", "barbecue",
    "bbq", "british", "french", "german", "spanish", "portuguese", "greek",
    "mediterranean", "fish_and_chips", "australian", "bar_and_grill", "tapas",
  ],
  "Italian & pizza": ["italian", "pizza", "pasta", "italian_pizza"],
  "Burgers & sandwiches": [
    "burger", "sandwich", "hot_dog", "fries", "pretzel", "wrap",
  ],
  // 1,244, almost all of it fried-chicken chains.
  Chicken: ["chicken", "fried_chicken"],
  Seafood: ["seafood", "fish"],
  Noodles: ["noodle", "noodles"],
  "Middle Eastern": [
    "arab", "turkish", "kebab", "middle_eastern", "persian", "lebanese",
  ],
  Mexican: ["mexican", "tex-mex"],
  Desserts: [
    "ice_cream", "dessert", "cake", "donut", "frozen_yogurt", "pastry",
    "bakery", "crepe", "waffle", "chocolate", "durian",
  ],
  "Drinks & coffee": [
    "coffee_shop", "coffee", "tea", "bubble_tea", "juice", "smoothie",
  ],
  Vegetarian: ["vegetarian", "vegan"],
};

/**
 * Deliberately ungrouped, listed so the omission reads as a decision rather
 * than an oversight: each is common enough to notice but says nothing you
 * could choose dinner by. They leave the place in the pool without giving it a
 * chip of its own.
 */
const TOO_VAGUE = new Set([
  "international", "fusion", "snacks", "snack", "breakfast", "rice", "soup",
  "salad", "food", "muslim", "halal",
]);

/** Atom to group, flattened once at module load rather than per place. */
const ATOM_TO_GROUP = new Map<string, string>(
  Object.entries(GROUPS).flatMap(([group, atoms]) =>
    atoms.map((atom) => [atom, group] as const),
  ),
);

/**
 * The groups a raw `cuisine` tag belongs to, in the order they appear.
 *
 * One tag can yield several — "tea;coffee_shop" is one group, but
 * "cake;malaysian" is genuinely both a dessert place and a Malaysian one, and
 * a filter on either should find it. Returns an empty array for an absent,
 * unrecognised or deliberately vague tag.
 */
export function toCuisineGroups(tag: string | undefined): string[] {
  if (!tag) return [];

  const groups: string[] = [];
  for (const atom of tag.split(";")) {
    const key = atom.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key || TOO_VAGUE.has(key)) continue;

    const group = ATOM_TO_GROUP.get(key);
    if (group && !groups.includes(group)) groups.push(group);
  }
  return groups;
}
