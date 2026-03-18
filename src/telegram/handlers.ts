import TelegramBot from 'node-telegram-bot-api';
import { pendingJobsMap, getBot } from './bot.js';
import { sendApplicationEmail } from '../email/mailer.js';
import { logger } from '../utils/index.js';

/** Register all callback_query handlers on the bot. Call once at startup. */
export function registerHandlers(): void {
  const bot = getBot();

  bot.on('callback_query', async (query) => {
    const data = query.data ?? '';
    const chatId = query.message?.chat?.id;
    const messageId = query.message?.message_id;

    if (!data.startsWith('apply::')) {
      await bot.answerCallbackQuery(query.id);
      return;
    }

    const jobId = data.replace('apply::', '').slice(0, 55);
    const pending = pendingJobsMap.get(jobId);

    if (!pending) {
      await bot.answerCallbackQuery(query.id, {
        text: '⚠️ Session expired. Run a new scan to reload offers.',
        show_alert: true,
      });
      return;
    }

    const { job, match } = pending;
    logger.info(`Telegram: user requested email apply for "${job.title}"`, { cvVariant: match.selectedCvId });

    await bot.answerCallbackQuery(query.id, { text: 'Sending email...' });

    try {
      const result = await sendApplicationEmail(job, match.selectedCvId);

      const appliedNote = `\n\n✅ *Applied on ${new Date().toLocaleString('pl-PL')}*\n📧 Email sent to: ${result.sentTo}`;

      if (chatId && messageId) {
        try {
          await bot.editMessageText(
            (query.message?.text ?? '') + appliedNote,
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: 'HTML',
              reply_markup: { inline_keyboard: [[{ text: '✅ Applied', callback_data: 'noop' }]] },
            },
          );
        } catch {
          // If edit fails (message too old), just send a follow-up
          await bot.sendMessage(chatId, `✅ Email sent for *${job.title}* to ${result.sentTo}`, {
            parse_mode: 'HTML',
          });
        }
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Email apply failed for job ${jobId}`, { error: errorMsg });

      if (chatId) {
        await bot.sendMessage(chatId, `❌ Failed to send email: ${errorMsg}`);
      }
    }
  });

  bot.on('polling_error', (err) => {
    logger.error('Telegram polling error', { error: err.message });
  });

  logger.info('Telegram handlers registered');
}
