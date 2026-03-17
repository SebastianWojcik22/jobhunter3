import cron from 'node-cron';
import OpenAI from 'openai';
import { logger } from '../utils/index.js';
import { runScan, buildConfigFromEnv } from '../pipeline/scan-runner.js';
import { getBot } from '../telegram/bot.js';
import { registerHandlers } from '../telegram/handlers.js';

export function startScheduler(openai: OpenAI): void {
  const cronExpr = process.env['SCAN_CRON'] ?? '0 * * * *';

  if (!cron.validate(cronExpr)) {
    throw new Error(`Invalid SCAN_CRON expression: "${cronExpr}"`);
  }

  // Start Telegram bot and register handlers
  getBot();
  registerHandlers();

  const config = buildConfigFromEnv();
  logger.info(`Scheduler started. Cron: "${cronExpr}"`);
  logger.info(`Portals: ${config.enabledPortals.join(', ')}`);
  logger.info(`Keywords: ${config.keywords.join(', ')}`);
  logger.info(`Match threshold: ${config.matchThreshold}/100`);

  // Run immediately on start
  runScan(config, openai).catch(err => {
    logger.error('Initial scan failed', { error: err instanceof Error ? err.message : String(err) });
  });

  // Then run on cron schedule
  cron.schedule(cronExpr, () => {
    logger.info('Cron triggered: starting scan...');
    runScan(config, openai).catch(err => {
      logger.error('Scheduled scan failed', { error: err instanceof Error ? err.message : String(err) });
    });
  });
}
