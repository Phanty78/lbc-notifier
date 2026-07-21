import { Category } from "@maeldonnart/lbc-ts";

/** Configuration de la recherche. */
export const SEARCH = {
	query: "SSD 500Go",
	category: Category.ELECTRONIQUE_ACCESSOIRES_INFORMATIQUE,
	priceMin: 0,
	priceMax: 40,
	excludeReserved: true,
	intervalMs: 60_000,
	limit: 100,
	notifyInitialResults: false,
} as const;
