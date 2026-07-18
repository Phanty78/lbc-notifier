import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

interface SeenAds {
	ids: number[];
}

export async function readSeenIds(path: string): Promise<Set<number>> {
	const file = Bun.file(path);
	if (!(await file.exists())) return new Set();
	const data = (await file.json()) as SeenAds;
	return new Set(data.ids);
}

export async function saveSeenIds(
	path: string,
	ids: Set<number>,
): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await Bun.write(path, JSON.stringify({ ids: [...ids] } satisfies SeenAds));
}
