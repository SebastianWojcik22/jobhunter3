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

  // Store in pending map for callback resolution
  pendingJobsMap.set(job.id, { job, match });

  await bot.sendMessage(Number(chatId), text, {
    parse_mode: 'MarkdownV2',
    reply_markup: {
      inline_keyboard: [[
        { text: '🔗 View Job', url: job.url },
        { text: '📧 Apply via Email', callback_data: `apply::${job.id}` },
      ]],
    },
  });

  logger.info(`Telegram: notification sent for "${job.title}"`, { score: match.score });
}

export async function sendTextMessage(text: string): Promise<void> {
  const chatId = process.env['TELEGRAM_CHAT_ID'];
  if (!chatId) return;
  const bot = getBot();
  await bot.sendMessage(Number(chatId), text);
}
