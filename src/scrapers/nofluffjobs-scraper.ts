import { JobOffer, Portal, WorkMode } from '../types/index.js';
import { BaseScraper } from './base-scraper.js';
import { logger, withRetry } from '../utils/index.js';

interface NFJPosting {
  id: string;
  name: string;   // company name
  title: string;  // job title
  location?: {
    places?: Array<{ city?: string; provinceOnly?: boolean }>;
  };
  fullyRemote?: boolean;
  seniority?: string[];
  technology?: string;
  salary?: {
    from?: number;
    to?: number;
    currency?: string;
    type?: string;
  };
  tiles?: {
    values?: Array<{ value: string; type: string }>;
  };
}

interface NFJSearchResponse {
  postings: NFJPosting[];
  totalCount?: number;
}

export class NoFluffJobsScraper extends BaseScraper {
  readonly portal: Portal = 'nofluffjobs';
  private readonly baseUrl = 'https://nofluffjobs.com/api';

  async fetchOffers(keywords: string[], maxOffers: number): Promise<JobOffer[]> {
    logger.info('NoFluffJobs: fetching offers...');

    const url = `${this.baseUrl}/search/posting?salaryCurrency=PLN&salaryPeriod=month`;
    const seenIds = new Set<string>();
    const allOffers: JobOffer[] = [];
    const perKeyword = Math.ceil(maxOffers / keywords.length);

    for (const keyword of keywords) {
      if (allOffers.length >= maxOffers) break;

      const data = await withRetry(
        async () => {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Accept-Language': 'en',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            body: JSON.stringify({
              criteriaSearch: { keyword: [keyword] },
              page: 1,
              pageSize: perKeyword,
              sortBy: 'newest',
            }),
          });
          if (!res.ok) throw new Error(`NoFluffJobs API returned ${res.status}`);
          return res.json() as Promise<NFJSearchResponse>;
        },
        `NoFluffJobs fetch (${keyword})`,
      );

      const postings = data.postings ?? [];
      logger.info(`NoFluffJobs: "${keyword}" → ${postings.length} offers`);

      for (const p of postings) {
        if (allOffers.length >= maxOffers) break;
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          allOffers.push(this.normalize(p));
        }
      }
    }

    logger.info(`NoFluffJobs: total ${allOffers.length} offers`);
    return allOffers;
  }

  private normalize(raw: NFJPosting): JobOffer {
    const workMode: WorkMode = raw.fullyRemote ? 'remote' : 'onsite';

    const firstPlace = raw.location?.places?.find(p => !p.provinceOnly);
    const location = firstPlace?.city ?? 'Unknown';

    const salary = raw.salary?.from || raw.salary?.to
      ? {
          min: raw.salary.from ?? null,
          max: raw.salary.to ?? null,
          currency: raw.salary.currency ?? 'PLN',
          contractType: (raw.salary.type === 'b2b' ? 'b2b' : 'unknown') as 'b2b' | 'unknown',
        }
      : null;

    const skills = raw.tiles?.values
      ?.filter(t => t.type === 'requirement')
      .map(t => t.value) ?? [];

    return {
      id: this.makeId(raw.id),
      portal: this.portal,
      portalJobId: raw.id,
      title: raw.title,
      company: raw.name,
      location,
      workMode,
      salary,
      skills,
      fullDescription: this.cleanText(raw.title),
      responsibilities: [],
      url: `https://nofluffjobs.com/job/${raw.id}`,
      applyEmail: null,
      scrapedAt: new Date().toISOString(),
    };
  }
}
