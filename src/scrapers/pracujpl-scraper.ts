import { chromium, Browser, Page } from 'playwright';
import { JobOffer, Portal, WorkMode } from '../types/index.js';
import { BaseScraper } from './base-scraper.js';
import { logger, sleep } from '../utils/index.js';

export class PracujPlScraper extends BaseScraper {
  readonly portal: Portal = 'pracujpl';

  async fetchOffers(keywords: string[], maxOffers: number): Promise<JobOffer[]> {
    logger.info('Pracuj.pl: launching Playwright...');
    const headless = process.env['PLAYWRIGHT_HEADLESS'] !== 'false';
    const browser = await chromium.launch({ headless });
    try {
      return await this.scrape(browser, keywords, maxOffers);
    } finally {
      await browser.close();
    }
  }

  private async scrape(browser: Browser, keywords: string[], maxOffers: number): Promise<JobOffer[]> {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'pl-PL,pl;q=0.9' });

    // Use first keyword only — Pracuj.pl treats multiple words as phrase search → 0 results
    const query = keywords[0] ?? 'it';
    const searchUrl = `https://www.pracuj.pl/praca/${encodeURIComponent(query)};kw`;

    logger.info(`Pracuj.pl: navigating to ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 45000 });

    // Accept cookies if dialog appears
    try {
      const cookieBtn = page.locator('[data-test="button-cookiesAcceptAll"]');
      if (await cookieBtn.isVisible({ timeout: 3000 })) {
        await cookieBtn.click();
        await sleep(500);
      }
    } catch { /* no cookie dialog */ }

    const offers: JobOffer[] = [];
    const seenIds = new Set<string>();

    let pageNum = 1;
    while (offers.length < maxOffers) {
      logger.info(`Pracuj.pl: scraping page ${pageNum}...`);
      await page.waitForSelector('[data-test="default-offer"]', { timeout: 15000 });

      const cards = await page.locator('[data-test="default-offer"]').all();
      if (cards.length === 0) break;

      for (const card of cards) {
        if (offers.length >= maxOffers) break;

        try {
          const titleEl = card.locator('[data-test="offer-title"]');
          const companyEl = card.locator('[data-test="text-company-name"]');
          const locationEl = card.locator('[data-test="text-region"]');
          const linkEl = card.locator('a[href*="pracuj.pl/praca/"]').first();

          const title = await titleEl.textContent() ?? '';
          const company = await companyEl.textContent() ?? '';
          const location = await locationEl.textContent() ?? '';
          const href = await linkEl.getAttribute('href') ?? '';

          if (!href || !title) continue;

          // Extract job ID from URL
          const idMatch = href.match(/,oferta,(\d+)/);
          const portalJobId = idMatch?.[1] ?? href;

          if (seenIds.has(portalJobId)) continue;
          seenIds.add(portalJobId);

          const workMode = location.toLowerCase().includes('zdaln') ||
                           location.toLowerCase().includes('remote') ? 'remote' : 'unknown';

          // Check for remote/hybrid badge
          let finalWorkMode: WorkMode = workMode;
          try {
            const badges = await card.locator('[data-test="offer-badge"]').allTextContents();
            for (const badge of badges) {
              const b = badge.toLowerCase();
              if (b.includes('zdaln') || b.includes('remote')) { finalWorkMode = 'remote'; break; }
              if (b.includes('hybrid')) { finalWorkMode = 'hybrid'; break; }
            }
          } catch { /* skip */ }

          const fullDescription = `${title}\n${company}\n${location}`;

          offers.push({
            id: this.makeId(portalJobId),
            portal: this.portal,
            portalJobId,
            title: this.cleanText(title),
            company: this.cleanText(company),
            location: this.cleanText(location),
            workMode: finalWorkMode,
            salary: null,
            skills: [],
            fullDescription,
            responsibilities: [],
            url: href.startsWith('http') ? href : `https://www.pracuj.pl${href}`,
            applyEmail: null,
            scrapedAt: new Date().toISOString(),
          });
        } catch (err) {
          logger.warn('Pracuj.pl: failed to parse one card', { error: String(err) });
        }
      }

      // Try next page
      try {
        const nextBtn = page.locator('[data-test="top-pagination-button-next"]');
        if (!(await nextBtn.isVisible({ timeout: 2000 })) || !(await nextBtn.isEnabled())) break;
        await nextBtn.click();
        await page.waitForLoadState('domcontentloaded');
        await sleep(1500);
        pageNum++;
      } catch {
        break;
      }
    }

    logger.info(`Pracuj.pl: scraped ${offers.length} offers`);

    // Enrich with full descriptions by visiting individual offer pages (limited to first 20)
    await this.enrichOffers(page, offers.slice(0, 20));

    return offers;
  }

  private async enrichOffers(page: Page, offers: JobOffer[]): Promise<void> {
    for (const offer of offers) {
      try {
        await page.goto(offer.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await sleep(800);

        const descEl = page.locator('[data-test="section-benefit-description"]').first();
        if (await descEl.isVisible({ timeout: 3000 })) {
          offer.fullDescription = this.cleanText(await descEl.textContent() ?? offer.fullDescription);
        }

        // Extract salary if visible
        try {
          const salaryEl = page.locator('[data-test="section-salary"]').first();
          if (await salaryEl.isVisible({ timeout: 1000 })) {
            const salaryText = await salaryEl.textContent() ?? '';
            const nums = salaryText.match(/(\d[\d\s]*\d)/g);
            if (nums && nums.length >= 1) {
              const clean = (s: string) => parseInt(s.replace(/\s/g, ''), 10);
              offer.salary = {
                min: clean(nums[0] ?? '0'),
                max: nums[1] ? clean(nums[1]) : null,
                currency: salaryText.includes('EUR') ? 'EUR' : 'PLN',
                contractType: 'unknown',
              };
            }
          }
        } catch { /* no salary */ }

        // Extract skills
        try {
          const skills = await page.locator('[data-test="chip-expected-skill"]').allTextContents();
          offer.skills = skills.map(s => this.cleanText(s)).filter(Boolean);
        } catch { /* no skills */ }

      } catch (err) {
        logger.warn(`Pracuj.pl: failed to enrich ${offer.url}`, { error: String(err) });
      }
    }
  }
}
