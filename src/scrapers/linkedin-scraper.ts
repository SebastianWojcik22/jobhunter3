import { chromium, Browser, Page } from 'playwright';
import { JobOffer, Portal, WorkMode } from '../types/index.js';
import { BaseScraper } from './base-scraper.js';
import { logger, sleep } from '../utils/index.js';

/**
 * LinkedIn scraper using Playwright with basic stealth measures.
 * This scraper is intentionally ISOLATED – all errors return [] and are logged.
 * LinkedIn actively blocks bots; success is best-effort.
 */
export class LinkedInScraper extends BaseScraper {
  readonly portal: Portal = 'linkedin';

  async fetchOffers(keywords: string[], maxOffers: number): Promise<JobOffer[]> {
    const searchUrl = process.env['LINKEDIN_SEARCH_URL'];
    if (!searchUrl) {
      logger.warn('LinkedIn: LINKEDIN_SEARCH_URL not set, skipping');
      return [];
    }

    logger.info('LinkedIn: launching Playwright...');
    const headless = process.env['PLAYWRIGHT_HEADLESS'] !== 'false';

    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({
        headless,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
      });

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        locale: 'en-US',
        viewport: { width: 1280, height: 800 },
      });

      const page = await context.newPage();

      // Patch navigator to avoid automation detection
      await page.addInitScript(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Object.defineProperty((globalThis as any).navigator, 'webdriver', { get: () => false });
      });

      const offers = await this.scrape(page, searchUrl, keywords, maxOffers);
      logger.info(`LinkedIn: scraped ${offers.length} offers`);
      return offers;

    } catch (err) {
      logger.warn('LinkedIn: scraping failed (isolated – other portals unaffected)', {
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    } finally {
      await browser?.close();
    }
  }

  private async scrape(page: Page, searchUrl: string, keywords: string[], maxOffers: number): Promise<JobOffer[]> {
    const email = process.env['LINKEDIN_EMAIL'];
    const password = process.env['LINKEDIN_PASSWORD'];

    if (email && password) {
      await this.login(page, email, password);
    }

    logger.info(`LinkedIn: navigating to search URL`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000 + Math.random() * 1000);

    const offers: JobOffer[] = [];
    const seenIds = new Set<string>();

    // Check for CAPTCHA / login wall
    const bodyText = await page.locator('body').textContent() ?? '';
    if (bodyText.includes('Join now') || bodyText.includes('Sign in to view') || bodyText.includes('authwall')) {
      logger.warn('LinkedIn: hit auth wall or CAPTCHA, skipping');
      return [];
    }

    const cards = await page.locator('.jobs-search__results-list li, .job-card-container').all();
    if (cards.length === 0) {
      logger.warn('LinkedIn: no job cards found (selector may have changed)');
      return [];
    }

    for (const card of cards.slice(0, maxOffers)) {
      try {
        const titleEl = card.locator('.base-search-card__title, .job-card-list__title').first();
        const companyEl = card.locator('.base-search-card__subtitle, .job-card-container__company-name').first();
        const locationEl = card.locator('.job-search-card__location, .job-card-container__metadata-wrapper').first();
        const linkEl = card.locator('a[href*="linkedin.com/jobs/view/"]').first();

        const title = await titleEl.textContent().catch(() => '') ?? '';
        const company = await companyEl.textContent().catch(() => '') ?? '';
        const location = await locationEl.textContent().catch(() => '') ?? '';
        const href = await linkEl.getAttribute('href').catch(() => '') ?? '';

        if (!title || !href) continue;

        const idMatch = href.match(/\/jobs\/view\/(\d+)/);
        const portalJobId = idMatch?.[1] ?? href;

        if (seenIds.has(portalJobId)) continue;
        seenIds.add(portalJobId);

        const workMode = this.inferWorkMode(location, title);

        offers.push({
          id: this.makeId(portalJobId),
          portal: this.portal,
          portalJobId,
          title: this.cleanText(title),
          company: this.cleanText(company),
          location: this.cleanText(location),
          workMode,
          salary: null,
          skills: [],
          fullDescription: `${this.cleanText(title)}\n${this.cleanText(company)}\n${this.cleanText(location)}`,
          responsibilities: [],
          url: href.split('?')[0] ?? href,
          applyEmail: null,
          scrapedAt: new Date().toISOString(),
        });

        await sleep(200 + Math.random() * 300);
      } catch (err) {
        logger.warn('LinkedIn: failed to parse one card', { error: String(err) });
      }
    }

    return offers;
  }

  private async login(page: Page, email: string, password: string): Promise<void> {
    logger.info('LinkedIn: attempting login...');
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
    await sleep(1000);
    await page.fill('#username', email);
    await sleep(500);
    await page.fill('#password', password);
    await sleep(500);
    await page.click('[type="submit"]');
    await page.waitForLoadState('domcontentloaded');
    await sleep(2000);

    const currentUrl = page.url();
    if (currentUrl.includes('checkpoint') || currentUrl.includes('challenge')) {
      throw new Error('LinkedIn: login blocked by CAPTCHA or security checkpoint');
    }
    logger.info('LinkedIn: login successful');
  }

  private inferWorkMode(location: string, title: string): WorkMode {
    const text = `${location} ${title}`.toLowerCase();
    if (text.includes('remote') || text.includes('zdaln')) return 'remote';
    if (text.includes('hybrid')) return 'hybrid';
    return 'unknown';
  }
}
