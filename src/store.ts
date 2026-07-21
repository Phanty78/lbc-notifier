import postgres from "postgres";
import { getDatabaseUrl } from "./env.js";

/** Store des annonces déjà vues. Agnostique du backend côté `index.ts`. */
export interface SeenAdsStore {
	load(): Promise<Set<number>>;
	/** Insère les ids nouveaux (idempotent : conflits ignorés). */
	add(ids: number[]): Promise<void>;
}

interface SeenAdsRow {
	id: number;
}

/** Store Postgres direct : table `seen_ads(id bigint PK, first_seen_at timestamptz)`. */
class PostgresStore implements SeenAdsStore {
	private readonly sql;

	constructor() {
		// Connexion directe (user postgres = superuser, bypass RLS).
		this.sql = postgres(getDatabaseUrl());
	}

	async load(): Promise<Set<number>> {
		const rows = await this.sql<SeenAdsRow[]>`select id from seen_ads`;
		return new Set(rows.map((row) => row.id));
	}

	async add(ids: number[]): Promise<void> {
		if (!ids.length) return;
		const rows = ids.map((id) => ({ id }));
		await this.sql`insert into seen_ads ${this.sql(
			rows,
		)} on conflict (id) do nothing`;
	}
}

export function createStore(): SeenAdsStore {
	return new PostgresStore();
}
