import { JobOffer, Portal, WorkMode, ContractType } from '../types/index.js';
import { BaseScraper } from './base-scraper.js';
import { logger } from '../utils/index.js';

interface JJOffer {
  id: string;
  title: string;
  company_name: string;
  city: string;
  remote: boolean;
  marker_icon: string;
  workplace_type: string;
  employment_types: Array<{
    type: string;
    salary: {
      from: number | null;
      to: number | null;
      currency: string;
    } | null;
  }>;
  skills: Array<{ name: string }>;
  body_html?: string;
  description?: string;
}

export class JustJoinScraper extends BaseScraper {
  readonly portal: Portal = 'justjoin';
  private readonly apiUrl = 'https://justjoin.it/api/offers';

  async fetchOffers(keywords: string[], maxOffers: number): Promise<JobOffer[]> {
    logger.info('JustJoin: fetching offers...');
    const response = await fetch(this.apiUrl, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`JustJoin API returned ${response.status}`);
    }

    const all: JJOffer[] = await response.json() as JJOffer[];
    logger.info(`JustJoin: got ${all.length} total offers`);

    const lowerKeywords = keywords.map(k => k.toLowerCase());
    const filtered = all.filter(offer => {
      const haystack = [
        offer.title,
        ...(offer.skills?.map(s => s.name) ?? []),
        offer.marker_icon,
      ].join(' ').toLowerCase();
      return lowerKeywords.some(k => haystack.includes(k));
    });

    logger.info(`JustJoin: ${filtered.length} offers after keyword filter`);

    return filtered.slice(0, maxOffers).map(raw => this.normalize(raw));
  }

  private normalize(raw: JJOffer): JobOffer {
    const employment = raw.employment_types?.[0];
    const salary = employment?.salary
      ? {
          min: employment.salary.from,
          max: employment.salary.to,
          currency: employment.salary.currency ?? 'PLN',
          contractType: this.mapContractType(employment.type),
        }
      : null;

    const workMode = raw.remote ? 'remote' : this.mapWorkplaceType(raw.workplace_type);
    const fullDescription = this.cleanText(raw.body_html?.replace(/<[^>]+>/g, ' ') ?? raw.description ?? raw.title);

    return {
      id: this.makeId(raw.id),
      portal: this.portal,
      portalJobId: raw.id,
      title: raw.title,
      company: raw.company_name,
      location: raw.city || 'Unknown',
      workMode,
      salary,
      skills: raw.skills?.map(s => s.name) ?? [],
      fullDescription,
      responsibilities: [],
      url: `https://justjoin.it/offers/${raw.id}`,
      applyEmail: null,
      scrapedAt: new Date().toISOString(),
    };
  }

  private mapWorkplaceType(type: string): WorkMode {
    switch (type?.toLowerCase()) {
      case 'remote': return 'remote';
      case 'hybrid': return 'hybrid';
      case 'office': return 'onsite';
      default: return 'unknown';
    }
  }

  private mapContractType(type: string): ContractType {
    switch (type?.toLowerCase()) {
      case 'b2b': return 'b2b';
      case 'permanent': return 'employment';
      case 'mandate_contract': return 'mandate';
      case 'internship': return 'internship';
      default: return 'unknown';
    }
  }
}
