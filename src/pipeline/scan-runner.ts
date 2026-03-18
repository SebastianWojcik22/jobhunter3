import OpenAI from 'openai';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Portal, ScanRunSummary } from '../types/index.js';
import { logger, writeJson, ensureDir } from '../utils/index.js';
import { runAllScrapers } from '../scrapers/index.js';
import { filterNew, markAsSeen } from '../dedup/deduplicator.js';
import { loadAllCvProfiles } from '../cv/index.js';
import { batchMatch } from '../matching/matcher.js';
import { sendJobNotification } from '../telegram/bot.js';
import type { CvVariant } from '../types/index.js';

export interface ScanConfig {
  enabledPortals: Portal[];
  keywords: string[];
  maxPerPortal: number;
  matchThreshold: number;
  matchMaxPerRun: number;
  openaiModel: string;
}

export function buildConfigFromEnv(): ScanConfig {
  return {
    enabledPortals: (process.env['ENABLED_PORTALS'] ?? 'justjoin,nofluffjobs')
      .split(',')
      .map(p => p.trim() as Portal)
      .filter(Boolean),
    keywords: (process.env['SCRAPER_KEYWORDS'] ?? 'typescript,node.js,automation,project manager')
      .split(',')
      .map(k => k.trim())
      .filter(Boolean),
    maxPerPortal: parseInt(process.env['SCRAPER_MAX_PER_PORTAL'] ?? '100', 10),
    matchThreshold: parseInt(process.env['MATCH_THRESHOLD'] ?? '60', 10),
    matchMaxPerRun: parseInt(process.env['MATCH_MAX_PER_RUN'] ?? '50', 10),
    openaiModel: process.env['OPENAI_MODEL'] ?? 'gpt-4o',
  };
}

export async function runScan(config: ScanConfig, openai: OpenAI): Promise<ScanRunSummary> {
  const runId = uuidv4();
  const startedAt = new Date().toISOString();
  logger.info(`=== Scan run started: ${runId} ===`);

  // 1. Load all 6 CV variants (from cache or parse on first run)
  const cvProfiles = await loadAllCvProfiles(openai, config.openaiModel);
  logger.info(`CV registry loaded: ${cvProfiles.size} variants`);

  // Build CvVariant[] with activation keywords — GPT-4o selects the best variant per job
  const VARIANT_KEYWORDS: Record<string, string[]> = {
    'developer-en': ['typescript', 'node.js', 'api', 'backend', 'developer', 'engineer', 'llm', 'gpt', 'fullstack'],
    'developer-pl': ['typescript', 'node.js', 'api', 'backend', 'developer', 'inżynier', 'llm', 'gpt', 'fullstack'],
    'automation-en': ['automation', 'make', 'n8n', 'zapier', 'workflow', 'integration', 'playwright', 'rpa', 'ai'],
    'automation-pl': ['automatyzacja', 'workflow', 'integracja', 'make', 'n8n', 'playwright', 'ai', 'procesy'],
    'pm-en': ['project manager', 'pm', 'scrum', 'agile', 'product', 'coordinator', 'delivery', 'jira'],
    'pm-pl': ['kierownik projektu', 'pm', 'scrum', 'agile', 'koordynator', 'delivery', 'jira', 'product owner'],
    'aicreator-en': ['prompt engineer', 'ai creator', 'generative ai', 'ai content', 'ai video', 'vibe coding', 'midjourney', 'dall-e', 'runway', 'storyboard', 'prompt library', 'ai creative', 'llm prompt'],
    'aicreator-pl': ['inżynier promptów', 'ai creator', 'generatywna ai', 'treści ai', 'prompt engineering', 'vibe coding', 'midjourney', 'storyboard', 'biblioteka promptów', 'kreatywność ai'],
  };
  const cvVariants: CvVariant[] = Array.from(cvProfiles.entries()).map(([id, profile]) => ({
    id,
    role: profile.variantId.split('-')[0] as CvVariant['role'],
    language: profile.variantId.split('-')[1] as CvVariant['language'],
    keywords: VARIANT_KEYWORDS[id] ?? [],
    profile,
  }));

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

  // Mark all new offers as seen immediately to prevent re-processing on crash
  markAsSeen(newOffers);

  // 3b. Filter out roles requiring 5+ years of experience (based on description, not title)
  // Matches: "5+ years", "5 years", "5 lat", "6 lat", "7+ lat", "8 years" etc. in PL and EN
  const HIGH_EXP_REGEX = /\b([5-9]|\d{2})\+?\s*(?:years?|lat|lata|roku)\b/i;
  const filteredOffers = newOffers.filter(o => !HIGH_EXP_REGEX.test(o.fullDescription));
  const filteredOut = newOffers.length - filteredOffers.length;
  if (filteredOut > 0) logger.info(`Seniority filter: removed ${filteredOut} offers requiring 5+ years experience`);

  // 4. Match each job — GPT-4o selects the best CV variant itself
  const matchResults = await batchMatch(
    filteredOffers,
    cvVariants,
    openai,
    config.openaiModel,
    config.matchThreshold,
    config.matchMaxPerRun,
  );

  const matches = matchResults.filter(r => r.isMatch);
  logger.info(`Matches found: ${matches.length}`);

  // 5. Send Telegram notifications (includes CV variant info)
  let notificationsSent = 0;
  for (const matchResult of matches) {
    const job = filteredOffers.find(o => o.id === matchResult.jobId);
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
  writeJson(`data/match-results/${runId}-matches.json`, { runId, matches: matches });

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
