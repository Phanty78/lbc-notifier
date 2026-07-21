export interface TelegramConfig {
	botToken: string;
	chatId: string;
}

export function getTelegramConfig(): TelegramConfig {
	const botToken = Bun.env.TELEGRAM_BOT_TOKEN;
	const chatId = Bun.env.TELEGRAM_CHAT_ID;
	if (!botToken || !chatId)
		throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required.");
	return { botToken, chatId };
}

export function getDatabaseUrl(): string {
	const url = Bun.env.DATABASE_URL;
	if (!url) throw new Error("DATABASE_URL is required.");
	return url;
}
