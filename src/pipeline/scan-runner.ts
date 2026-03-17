import OpenAI from 'openai';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Portal, ScanRunSummary } from '../types/index.js';
import { logger, writeJson, ensureDir } from '../utils/index.js';
import { runAllScrapers } from '../scrapers/index.js';
import { filterNew, markAsSeen } from '../dedup/deduplicator.js';
import { getOrParseCv } from '../cv/index.js';
import { batchMatch } from '../matching/matcher.js';
import { sendJobNotification } from '../telegram/bot.js';

export interface ScanConfig {
  enabledPortals: Portal[];
  keywords: string[];
  maxPerPortal: number;
  matchThreshold: number;
  matchMaxPerRun: number;
  openaiModel: string;
  cvPdfPath: string;
}

export function buildConfigFromEnv(): ScanConfig {
  return {
    enabledPortals: (process.env['ENABLED_PORTALS'] ?? 'justjoin,nofluffjobs')
      .split(',')
      .map(p => p.trim() as Portal)
      .filter(Boolean),
    keywords: (process.env['SCRAPER_KEYWORDS'] ?? 'typescript,node.js')
      .split(',')
      .map(k => k.trim())
      .filter(Boolean),
    maxPerPortal: parseInt(process.env['SCRAPER_MAX_PER_PORTAL'] ?? '100', 10),
    matchThreshold: parseInt(process.env['MATCH_THRESHOLD'] ?? '60', 10),
    matchMaxPerRun: parseInt(process.env['MATCH_MAX_PER_RUN'] ?? '50', 10),
    openaiModel: process.env['OPENAI_MODEL'] ?? 'gpt-4o',
    cvPdfPath: path.resolve(process.env['CV_PDF_PATH'] ?? 'data/cv.pdf'),
  };
}

export async function runScan(config: ScanConfig, openai: OpenAI): Promise<ScanRunSummary> {
  const runId = uuidv4();
  const startedAt = new Date().toISOString();
  logger.info(`=== Scan run started: ${runId} ===`);

  // 1. Load or parse CV
  const cvProfile = await getOrParseCv(config.cvPdfPath, openai, config.openaiModel);

  // 2. Scrape all portals
  const { offers, errors, portalsScanned } = await runAllScrapers(
    config.enabledPortals,
    config.keywords,
    config.maxPerPortal,
  );

  logger.info(`Total offers fetched: ${offers.length}`);

  // 3. Deduplicate
  const { newOffers, duplicateCount } = filterNew(offers);
  logger.info(`New offers: ${newOffers.length} | Duplicates skipped: ${duplicateCount}`);

  if (newOffers.length === 0) {
    logger.info('No new offers to process');
    const summary: ScanRunSummary = {
      runId, startedAt, completedAt: new Date().toISOString(),
      portalsScanned, totalFetched: offers.length, newJobs: 0,
      duplicatesSkipped: duplicateCount, matchesFound: 0, notificationsSent: 0, errors,
    };
    saveSummary(summary);
    return summary;
  }

  // Mark all new offers as seen immediately (before matching) to prevent re-processing on crash
  markAsSeen(newOffers);

  // 4. Match with GPT-4o
  const matchResults = await batchMatch(
    newOffers,
    cvProfile,
    openai,
    config.openaiModel,
    config.matchThreshold,
    config.matchMaxPerRun,
  );

  const matches = matchResults.filter(r => r.isMatch);
  logger.info(`Matches found: ${matches.length}`);

  // 5. Send Telegram notifications
  let notificationsSent = 0;
  for (const matchResult of matches) {
    const job = newOffers.find(o => o.id === matchResult.jobId);
    if (!job) continue;
    try {
      await sendJobNotification(job, matchResult);
      notificationsSent++;
    } catch (err) {
      logger.error(`Failed to send Telegram notification for job ${matchResult.jobId}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 6. Save match results to disk
  ensureDir('data/match-results');
  const matchResultPath = `data/match-results/${runId}-matches.json`;
  writeJson(matchResultPath, { runId, matches: matchResults.filter(r => r.isMatch) });

  const summary: ScanRunSummary = {
    runId,
    startedAt,
    completedAt: new Date().toISOString(),
    portalsScanned,
    totalFetched: offers.length,
    newJobs: newOffers.length,
    duplicatesSkipped: duplicateCount,
    matchesFound: matches.length,
    notificationsSent,
    errors,
  };

  saveSummary(summary);
  logger.info(`=== Scan run completed: ${runId} ===`, {
    newJobs: summary.newJobs,
    matches: summary.matchesFound,
    notifications: summary.notificationsSent,
  });

  return summary;
}

function saveSummary(summary: ScanRunSummary): void {
  ensureDir('data/match-results');
  writeJson(`data/match-results/${summary.runId}-summary.json`, summary);
}
