import { JobOffer, Portal, ScanRunSummary } from '../types/index.js';
import { logger } from '../utils/index.js';
import { JustJoinScraper } from './justjoin-scraper.js';
import { NoFluffJobsScraper } from './nofluffjobs-scraper.js';
import { PracujPlScraper } from './pracujpl-scraper.js';
import { LinkedInScraper } from './linkedin-scraper.js';

export { JustJoinScraper, NoFluffJobsScraper, PracujPlScraper, LinkedInScraper };

const ALL_SCRAPERS = {
  justjoin: JustJoinScraper,
  nofluffjobs: NoFluffJobsScraper,
  pracujpl: PracujPlScraper,
  linkedin: LinkedInScraper,
} as const;

export interface ScraperRunResult {
  offers: JobOffer[];
  errors: ScanRunSummary['errors'];
  portalsScanned: Portal[];
}

export async function runAllScrapers(
  enabledPortals: Portal[],
  keywords: string[],
  maxPerPortal: number,
): Promise<ScraperRunResult> {
  const offers: JobOffer[] = [];
  const errors: ScanRunSummary['errors'] = [];
  const portalsScanned: Portal[] = [];

  for (const portal of enabledPortals) {
    const ScraperClass = ALL_SCRAPERS[portal];
    if (!ScraperClass) {
      logger.warn(`Unknown portal: ${portal}`);
      continue;
    }

    try {
      const scraper = new ScraperClass();
      const result = await scraper.fetchOffers(keywords, maxPerPortal);
      offers.push(...result);
      portalsScanned.push(portal);
      logger.info(`${portal}: fetched ${result.length} offers`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`${portal}: scraper failed`, { error: message });
      errors.push({ portal, message });
    }
  }

  return { offers, errors, portalsScanned };
}
