import { JobOffer, Portal, WorkMode } from '../types/index.js';
import { BaseScraper } from './base-scraper.js';
import { logger, withRetry } from '../utils/index.js';

interface NFJPosting {
  id: string;
  name: string;
  title: string;
  city?: string[];
  location?: { place?: string };
  remote: boolean;
  fullyRemote?: boolean;
  seniority?: string[];
  technology?: string;
  salary?: {
    from?: number;
    to?: number;
    currency?: string;
    type?: string;
  };
  essentialSkills?: string[];
  niceToHaveSkills?: string[];
  description?: { sections?: Array<{ title: string; description: string }> };
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

    const criteria = keywords.join(',');
    const url = `${this.baseUrl}/search/posting?criteria=${encodeURIComponent(criteria)}&page=1&pageSize=${maxOffers}`;

    const data = await withRetry(
      async () => {
        const res = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'Accept-Language': 'en',
            'User-Agent': 'Mozilla/5.0 (compatible; JobHunter3/1.0)',
          },
        });
        if (!res.ok) throw new Error(`NoFluffJobs API returned ${res.status}`);
        return res.json() as Promise<NFJSearchResponse>;
      },
      'NoFluffJobs fetch',
    );

    const postings = data.postings ?? [];
    logger.info(`NoFluffJobs: got ${postings.length} offers`);
    return postings.map(p => this.normalize(p));
  }

  private normalize(raw: NFJPosting): JobOffer {
    const workMode: WorkMode = raw.fullyRemote || raw.remote ? 'remote' : 'onsite';
    const location = raw.city?.[0] ?? raw.location?.place ?? 'Unknown';

    const salary = raw.salary?.from || raw.salary?.to
      ? {
          min: raw.salary.from ?? null,
          max: raw.salary.to ?? null,
          currency: raw.salary.currency ?? 'PLN',
          contractType: 'unknown' as const,
        }
      : null;

    const skills = [
      ...(raw.essentialSkills ?? []),
      ...(raw.niceToHaveSkills ?? []),
    ];

    const sections = raw.description?.sections ?? [];
    const fullDescription = sections.map(s => `${s.title}\n${s.description}`).join('\n\n')
      || raw.name || raw.title;

    return {
      id: this.makeId(raw.id),
      portal: this.portal,
      portalJobId: raw.id,
      title: raw.name || raw.title,
      company: '',
      location,
      workMode,
      salary,
      skills,
      fullDescription: this.cleanText(fullDescription),
      responsibilities: [],
      url: `https://nofluffjobs.com/job/${raw.id}`,
      applyEmail: null,
      scrapedAt: new Date().toISOString(),
    };
  }
}
