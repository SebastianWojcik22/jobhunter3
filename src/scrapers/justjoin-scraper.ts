import { chromium } from 'playwright';
import { JobOffer, Portal, WorkMode } from '../types/index.js';
import { BaseScraper } from './base-scraper.js';
import { logger, sleep } from '../utils/index.js';

export class JustJoinScraper extends BaseScraper {
  readonly portal: Portal = 'justjoin';

  async fetchOffers(keywords: string[], maxOffers: number): Promise<JobOffer[]> {
    logger.info('JustJoin: launching Playwright...');
    const headless = process.env['PLAYWRIGHT_HEADLESS'] !== 'false';
    const browser = await chromium.launch({ headless });
    try {
      const allOffers: JobOffer[] = [];
      const seenIds = new Set<string>();

      for (const keyword of keywords) {
        if (allOffers.length >= maxOffers) break;
        const page = await browser.newPage();
        try {
          const offers = await this.scrapeKeyword(page, keyword, maxOffers - allOffers.length, seenIds);
          allOffers.push(...offers);
        } finally {
          await page.close();
        }
      }

      logger.info(`JustJoin: total ${allOffers.length} offers scraped`);
      return allOffers;
    } finally {
      await browser.close();
    }
  }

  private async scrapeKeyword(
    page: import('playwright').Page,
    keyword: string,
    maxOffers: number,
    seenIds: Set<string>,
  ): Promise<JobOffer[]> {
    const url = `https://justjoin.it/job-offers?keyword=${encodeURIComponent(keyword)}&sortBy=newest`;
    logger.info(`JustJoin: navigating for keyword "${keyword}"...`);

    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });

    // Accept cookies
    try {
      const cookieBtn = page.locator('button:has-text("Accept"), button:has-text("Akceptuj")').first();
      if (await cookieBtn.isVisible({ timeout: 3000 })) {
        await cookieBtn.click();
        await sleep(500);
      }
    } catch { /* no cookie dialog */ }

    const count = await page.locator('[data-index]').count();
    if (count === 0) {
      logger.warn(`JustJoin: no offer cards found for "${keyword}"`);
      return [];
    }

    const offers: JobOffer[] = [];
    let attempts = 0;
    const maxAttempts = 5;

    while (offers.length < maxOffers && attempts < maxAttempts) {
      await sleep(1000);

      // Try multiple selector patterns JustJoin has used
      const cards = await page.locator('[data-index]').all();
      if (cards.length === 0) break;

      for (const card of cards) {
        if (offers.length >= maxOffers) break;
        try {
          const linkEl = card.locator('a[href*="/job-offer/"]').first();
          const href = await linkEl.getAttribute('href').catch(() => null);
          if (!href) continue;

          const slug = href.split('/').filter(Boolean).pop() ?? href;
          if (seenIds.has(slug)) continue;
          seenIds.add(slug);

          const titleEl = card.locator('h2, h3').first();
          const title = await titleEl.textContent().catch(() => '') ?? '';
          if (!title.trim()) continue;

          // Company name is in a span/div after the title
          const allText = await card.textContent().catch(() => '') ?? '';
          const company = '';  // not reliably extractable from list view

          const isRemote = allText.toLowerCase().includes('remote') ||
                           allText.toLowerCase().includes('zdaln') ||
                           allText.toLowerCase().includes('fully remote');
          const workMode: WorkMode = isRemote ? 'remote' : 'unknown';

          offers.push({
            id: this.makeId(slug),
            portal: this.portal,
            portalJobId: slug,
            title: this.cleanText(title),
            company: this.cleanText(company),
            location: 'Unknown',
            workMode,
            salary: null,
            skills: [],
            fullDescription: this.cleanText(title),
            responsibilities: [],
            url: href.startsWith('http') ? href : `https://justjoin.it${href}`,
            applyEmail: null,
            scrapedAt: new Date().toISOString(),
          });
        } catch { /* skip card */ }
      }

      // Try to load more
      try {
        const loadMoreBtn = page.locator('button:has-text("Load more"), button:has-text("Więcej ofert")').first();
        if (await loadMoreBtn.isVisible({ timeout: 2000 }) && offers.length < maxOffers) {
          await loadMoreBtn.click();
          attempts++;
          await sleep(2000);
        } else {
          break;
        }
      } catch {
        break;
      }
    }

    logger.info(`JustJoin: "${keyword}" → ${offers.length} offers`);
    return offers;
  }
}
