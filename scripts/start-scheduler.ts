import 'dotenv/config';
import OpenAI from 'openai';
import { startScheduler } from '../src/scheduler/index.js';
import { logger } from '../src/utils/index.js';

const apiKey = process.env['OPENAI_API_KEY'];
if (!apiKey) {
  logger.error('OPENAI_API_KEY is not set. Copy .env.example → .env and fill in your keys.');
  process.exit(1);
}

const openai = new OpenAI({ apiKey });

logger.info('JobHunter3 starting...');

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down...');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});

startScheduler(openai);
