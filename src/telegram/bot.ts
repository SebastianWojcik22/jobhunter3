import TelegramBot from 'node-telegram-bot-api';
import { JobOffer, MatchResult } from '../types/index.js';
import { logger } from '../utils/index.js';
import { formatJobNotification } from './formatter.js';

let botInstance: TelegramBot | null = null;

/** In-memory map of jobId → JobOffer for pending apply actions */
export const pendingJobsMap = new Map<string, { job: JobOffer; match: MatchResult }>();

export function getBot(): TelegramBot {
  if (!botInstance) {
    const token = process.env['TELEGRAM_BOT_TOKEN'];
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');
    botInstance = new TelegramBot(token, { polling: true });
    logger.info('Telegram bot started (polling mode)');
  }
  return botInstance;
}

export function stopBot(): void {
  if (botInstance) {
    botInstance.stopPolling();
    botInstance = null;
    logger.info('Telegram bot stopped');
  }
}

export async function sendJobNotification(job: JobOffer, match: MatchResult): Promise<void> {
  const chatId = process.env['TELEGRAM_CHAT_ID'];
  if (!chatId) throw new Error('TELEGRAM_CHAT_ID is not set');

  const bot = getBot();
  const text = formatJobNotification(job, match);

  // Telegram callback_data limit is 64 bytes; use short key (first 55 chars of hash)
  const shortKey = job.id.slice(0, 55);
  pendingJobsMap.set(shortKey, { job, match });

  const buttons = [{ text: '🔗 Apply on Portal', url: job.url }];
  if (job.applyEmail) {
    buttons.push({ text: '📧 Apply via Email', callback_data: `apply::${shortKey}` } as never);
  }

  await bot.sendMessage(Number(chatId), text, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [buttons] },
  });

  logger.info(`Telegram: notification sent for "${job.title}"`, { score: match.score });
}

export async function sendTextMessage(text: string): Promise<void> {
  const chatId = process.env['TELEGRAM_CHAT_ID'];
  if (!chatId) return;
  const bot = getBot();
  await bot.sendMessage(Number(chatId), text);
}
