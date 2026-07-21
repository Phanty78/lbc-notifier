import { type Ad, Client, RequestError, Sort } from "@maeldonnart/lbc-ts";
import { SEARCH } from "./constant.js";
import { getTelegramConfig } from "./env.js";
import { createStore } from "./store.js";
import { sendTelegramMessage } from "./telegram.js";

/** Nombre de retry sur 503 datadome (non géré par lbc-ts, qui ne retry que le 403). */
const MAX_503_RETRIES = 1;

const telegram = getTelegramConfig();
const store = createStore();
const seenIds = await store.load();
// Ids ajoutés au Set depuis le dernier `store.add` : persistés incrémentalement.
const newSeen: number[] = [];
let isFirstSearch = true;
let running = false;

// Client mutable : recréé pour rafraîchir le cookie datadome (refresh proactif + reset sur 503).
let client = new Client({ maxRetries: 1 });

/** Recrée le Client : nouveau cookie jar via GET home page. Évite cookie datadome stale. */
function refreshClient(): void {
	client = new Client({ maxRetries: 1 });
}

/** Options de recherche partagées entre tentatives. */
function searchOptions() {
	return {
		text: SEARCH.query,
		category: SEARCH.category,
		price: [SEARCH.priceMin, SEARCH.priceMax],
		sort: Sort.NEWEST,
		limit: SEARCH.limit,
	};
}

/**
 * Délai d'attente avant un retry après un 503 datadome, en millisecondes.
 *
 * Trade-off : backoff court = récupère vite les challenges temporaires mais
 * ressemble à un bot qui réessaie en rafale ; backoff long/expo = plus humain
 * mais retarde la prochaine recherche. Doit rester borné pour éviter boucle infinie.
 *
 * @param attempt - numéro de tentative (1 = premier retry)
 * @returns délai en ms avant de relancer la recherche
 */
function backoffMs(attempt: number): number {
	// Backoff exponentiel + jitter : 1s, 2s, 4s... + bruit aléatoire jusqu'à 1s.
	// Capé à 30s pour rester raisonnable même si MAX_503_RETRIES monte.
	const base = Math.min(30_000, 1_000 * 2 ** (attempt - 1));
	return base + Math.random() * 1_000;
}

/**
 * Effectue la recherche avec retry sur 503 : reset cookie + backoff entre tentatives.
 * Le 403 est déjà retry en interne par lbc-ts ; ici on couvre le 503 datadome.
 */
async function fetchWith503Retry(): Promise<ReturnType<Client["search"]>> {
	for (let attempt = 0; ; attempt++) {
		if (attempt === 0) refreshClient(); // refresh proactif avant chaque cycle
		try {
			return await client.search(searchOptions());
		} catch (error) {
			if (!(error instanceof RequestError) || attempt >= MAX_503_RETRIES)
				throw error;
			const delay = backoffMs(attempt + 1);
			console.log(
				`[${new Date().toISOString()}] 503/reset, retry ${attempt + 1}/${MAX_503_RETRIES} in ${delay}ms...`,
			);
			refreshClient();
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}
}

async function search(): Promise<void> {
	if (running) return;
	running = true;
	try {
		const result = await fetchWith503Retry();
		const newAds = result.ads.filter(
			(ad): ad is Ad & { id: number } =>
				ad.id !== undefined &&
				!seenIds.has(ad.id) &&
				(!SEARCH.excludeReserved || !isReservedOrSold(ad)),
		);
		if (isFirstSearch && !SEARCH.notifyInitialResults) {
			for (const ad of newAds) {
				seenIds.add(ad.id);
				newSeen.push(ad.id);
			}
			await store.add(newSeen);
			newSeen.length = 0;
			console.log(
				`[${new Date().toISOString()}] ${newAds.length} existing ads saved.`,
			);
			return;
		}
		if (!newAds.length)
			return console.log(`[${new Date().toISOString()}] No new ads.`);
		for (const ad of newAds.reverse()) {
			await sendTelegramMessage(telegram, formatAd(ad));
			seenIds.add(ad.id);
			newSeen.push(ad.id);
		}
		await store.add(newSeen);
		newSeen.length = 0;
		console.log(
			`[${new Date().toISOString()}] ${newAds.length} new ad(s) notified.`,
		);
	} catch (error) {
		console.error(`[${new Date().toISOString()}]`, error);
	} finally {
		isFirstSearch = false;
		running = false;
	}
}

/** Planifie le prochain cycle avec jitter pour casser la signature temporelle bot. */
function scheduleNext(): void {
	const jitter = SEARCH.intervalMs * 0.15 * (Math.random() * 2 - 1); // ±15%
	const delay = Math.max(10_000, SEARCH.intervalMs + jitter);
	setTimeout(async () => {
		await search();
		scheduleNext();
	}, delay);
}

function formatAd(ad: Ad): string {
	return [
		ad.subject ?? "New ad",
		ad.price === undefined ? undefined : `${ad.price} €`,
		ad.location.cityLabel,
		ad.url,
	]
		.filter(Boolean)
		.join("\n");
}

/** Annonce vendue ou en cours de vente (attribut Leboncoin `transaction_status`). */
function isReservedOrSold(ad: Ad): boolean {
	const status = ad.attributes?.transaction_status?.valueLabel;
	return status === "Vendu" || status === "Achat en cours";
}

console.log(`Watching "${SEARCH.query}" every ~${SEARCH.intervalMs / 1_000}s.`);
await search();
scheduleNext();
for (const signal of ["SIGINT", "SIGTERM"] as const)
	process.on(signal, () => {
		console.log("Stopping.");
		process.exit(0);
	});