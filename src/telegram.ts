import type { TelegramConfig } from "./env.js";

export async function sendTelegramMessage(config: TelegramConfig, text: string): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: config.chatId, text, disable_web_page_preview: true }),
  });
  if (!response.ok) throw new Error(`Telegram request failed (${response.status}).`);
}
