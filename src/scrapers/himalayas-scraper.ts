import { JobOffer, Portal } from '../types/index.js';
import { BaseScraper } from './base-scraper.js';
import { logger, withRetry } from '../utils/index.js';

interface HimalayasJob {
  title: string;
  companyName: string;
  companySlug: string;
  employmentType: string;
  minSalary: number | null;
  maxSalary: number | null;
  currency: string | null;
  seniority: string | null;
  locationRestrictions: string[];
  categories: string[];
  description: string;
  pubDate: string;
  applicationLink: string;
  guid: string;
}

interface HimalayasResponse {
  jobs: HimalayasJob[];
  totalCount: number;
}

export class HimalayasScraper extends BaseScraper {
  readonly portal: Portal = 'himalayas';

  async fetchOffers(keywords: string[], maxOffers: number): Promise<JobOffer[]> {
    logger.info('Himalayas: fetching offers...');

    const seenIds = new Set<string>();
    const allOffers: JobOffer[] = [];
    const perKeyword = Math.ceil(maxOffers / keywords.length);

    for (const keyword of keywords) {
      if (allOffers.length >= maxOffers) break;

      const data = await withRetry(async () => {
        const url = `https://himalayas.app/jobs/api?q=${encodeURIComponent(keyword)}&limit=${perKeyword}`;
        const res = await fetch(url, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        });
        if (!res.ok) throw new Error(`Himalayas API returned ${res.status}`);
        return res.json() as Promise<HimalayasResponse>;
      }, `Himalayas fetch (${keyword})`);

      const jobs = data.jobs ?? [];
      logger.info(`Himalayas: "${keyword}" → ${jobs.length} offers`);

      for (const j of jobs) {
        if (allOffers.length >= maxOffers) break;
        if (seenIds.has(j.guid)) continue;
        seenIds.add(j.guid);
        allOffers.push(this.normalize(j));
      }
    }

    logger.info(`Himalayas: total ${allOffers.length} offers`);
    return allOffers;
  }

  private normalize(j: HimalayasJob): JobOffer {
    const fullDescription = this.cleanText(
      (j.description ?? '').replace(/<[^>]+>/g, ' '),
    );
    const location = j.locationRestrictions?.join(', ') || 'Remote';

    const salary = j.minSalary || j.maxSalary
      ? {
          min: j.minSalary,
          max: j.maxSalary,
          currency: j.currency ?? 'USD',
          contractType: 'unknown' as const,
        }
      : null;

    return {
      id: this.makeId(j.guid),
      portal: this.portal,
      portalJobId: j.guid,
      title: j.title,
      company: j.companyName,
      location,
      workMode: 'remote',
      salary,
      skills: j.categories ?? [],
      fullDescription,
      responsibilities: [],
      url: j.applicationLink,
      applyEmail: this.extractEmail(fullDescription),
      scrapedAt: new Date().toISOString(),
    };
  }
}
