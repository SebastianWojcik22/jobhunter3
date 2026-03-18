import { JobOffer, Portal } from '../types/index.js';
import { BaseScraper } from './base-scraper.js';
import { logger, withRetry } from '../utils/index.js';

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category: string;
  tags: string[];
  job_type: string;
  publication_date: string;
  candidate_required_location: string;
  salary: string;
  description: string;
}

interface RemotiveResponse {
  jobs: RemotiveJob[];
  'job-count': number;
}

export class RemotiveScraper extends BaseScraper {
  readonly portal: Portal = 'remotive';

  async fetchOffers(keywords: string[], maxOffers: number): Promise<JobOffer[]> {
    logger.info('Remotive: fetching offers...');

    const seenIds = new Set<string>();
    const allOffers: JobOffer[] = [];
    const perKeyword = Math.ceil(maxOffers / keywords.length);

    for (const keyword of keywords) {
      if (allOffers.length >= maxOffers) break;

      const data = await withRetry(async () => {
        const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(keyword)}&limit=${perKeyword}`;
        const res = await fetch(url, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        });
        if (!res.ok) throw new Error(`Remotive API returned ${res.status}`);
        return res.json() as Promise<RemotiveResponse>;
      }, `Remotive fetch (${keyword})`);

      const jobs = data.jobs ?? [];
      logger.info(`Remotive: "${keyword}" → ${jobs.length} offers`);

      for (const j of jobs) {
        if (allOffers.length >= maxOffers) break;
        const portalJobId = String(j.id);
        if (seenIds.has(portalJobId)) continue;
        seenIds.add(portalJobId);
        allOffers.push(this.normalize(j));
      }
    }

    logger.info(`Remotive: total ${allOffers.length} offers`);
    return allOffers;
  }

  private normalize(j: RemotiveJob): JobOffer {
    const fullDescription = this.cleanText(
      j.description.replace(/<[^>]+>/g, ' '),
    );
    const applyEmail = this.extractEmail(fullDescription);

    return {
      id: this.makeId(String(j.id)),
      portal: this.portal,
      portalJobId: String(j.id),
      title: j.title,
      company: j.company_name,
      location: j.candidate_required_location || 'Remote',
      workMode: 'remote',
      salary: this.parseSalary(j.salary),
      skills: j.tags ?? [],
      fullDescription,
      responsibilities: [],
      url: j.url,
      applyEmail,
      scrapedAt: new Date().toISOString(),
    };
  }

  private parseSalary(salaryStr: string) {
    if (!salaryStr) return null;
    const nums = salaryStr.match(/\d[\d,]*/g);
    if (!nums || nums.length === 0) return null;
    const clean = (s: string) => parseInt(s.replace(/,/g, ''), 10);
    const currency = salaryStr.includes('€') ? 'EUR' : salaryStr.includes('£') ? 'GBP' : 'USD';
    return {
      min: clean(nums[0] ?? '0'),
      max: nums[1] ? clean(nums[1]) : null,
      currency,
      contractType: 'unknown' as const,
    };
  }
}
