import 'dotenv/config';
import OpenAI from 'openai';
import { runScan, buildConfigFromEnv } from '../src/pipeline/scan-runner.js';
import { getBot } from '../src/telegram/bot.js';
import { registerHandlers } from '../src/telegram/handlers.js';
import { logger } from '../src/utils/index.js';

const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });
const config = buildConfigFromEnv();

logger.info('Starting one-shot scan...');
logger.info(`Portals: ${config.enabledPortals.join(', ')}`);
logger.info(`Keywords: ${config.keywords.join(', ')}`);

// Start Telegram bot to handle "Apply" button clicks during this session
getBot();
registerHandlers();

runScan(config, openai)
  .then(summary => {
    logger.info('Scan complete', {
      newJobs: summary.newJobs,
      matches: summary.matchesFound,
      notifications: summary.notificationsSent,
      errors: summary.errors.length,
    });

    if (summary.errors.length > 0) {
      for (const e of summary.errors) {
        logger.warn(`Portal error: ${e.portal} – ${e.message}`);
      }
    }

    if (summary.matchesFound === 0) {
      logger.info('No matches found this run');
    } else {
      logger.info(`${summary.matchesFound} matches found – check Telegram for notifications`);
    }

    // Keep process alive for 5 minutes to handle Telegram button clicks
    logger.info('Keeping alive for 5 minutes to handle Telegram interactions...');
    setTimeout(() => {
      logger.info('Session ended');
      process.exit(0);
    }, 5 * 60 * 1000);
  })
  .catch(err => {
    logger.error('Scan failed', { error: err instanceof Error ? err.message : String(err) });
    process.exit(1);
  });
