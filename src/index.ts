import { type Ad, Client, Sort } from "@maeldonnart/lbc-ts";
import { SEARCH } from "./constant.js";
import { getTelegramConfig } from "./env.js";
import { createStore } from "./store.js";
import { sendTelegramMessage } from "./telegram.js";

const telegram = getTelegramConfig();
const client = new Client({ maxRetries: 1 });
const store = createStore();
const seenIds = await store.load();
// Ids ajoutés au Set depuis le dernier `store.add` : persistés incrémentalement.
const newSeen: number[] = [];
let isFirstSearch = true;
let running = false;

async function search(): Promise<void> {
	if (running) return;
	running = true;
	try {
		const result = await client.search({
			text: SEARCH.query,
			category: SEARCH.category,
			price: [SEARCH.priceMin, SEARCH.priceMax],
			sort: Sort.NEWEST,
			limit: SEARCH.limit,
		});
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

console.log(`Watching "${SEARCH.query}" every ${SEARCH.intervalMs / 1_000}s.`);
await search();
const interval = setInterval(search, SEARCH.intervalMs);
for (const signal of ["SIGINT", "SIGTERM"] as const)
	process.on(signal, () => {
		clearInterval(interval);
		console.log("Stopping.");
		process.exit(0);
	});
