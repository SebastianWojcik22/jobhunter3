import { JobOffer, Portal } from '../types/index.js';
import { BaseScraper } from './base-scraper.js';
import { logger, withRetry } from '../utils/index.js';

// WWR categories relevant to our target roles
const WWR_CATEGORIES = [
  'remote-programming-jobs',
  'remote-devops-sysadmin-jobs',
  'remote-product-jobs',
];

interface RssItem {
  title: string;
  link: string;
  pubDate: string;
  company: string;
  description: string;
  guid: string;
}

export class WeWorkRemotelyScraper extends BaseScraper {
  readonly portal: Portal = 'weworkremotely';

  async fetchOffers(keywords: string[], maxOffers: number): Promise<JobOffer[]> {
    logger.info('WeWorkRemotely: fetching offers...');

    const seenIds = new Set<string>();
    const allOffers: JobOffer[] = [];

    for (const category of WWR_CATEGORIES) {
      if (allOffers.length >= maxOffers) break;

      const items = await withRetry(async () => {
        const url = `https://weworkremotely.com/categories/${category}.rss`;
        const res = await fetch(url, {
          headers: { 'Accept': 'application/rss+xml, text/xml', 'User-Agent': 'Mozilla/5.0' },
        });
        if (!res.ok) throw new Error(`WWR RSS returned ${res.status}`);
        const xml = await res.text();
        return this.parseRss(xml);
      }, `WWR fetch (${category})`);

      logger.info(`WeWorkRemotely: "${category}" → ${items.length} items`);

      const lowerKeywords = keywords.map(k => k.toLowerCase());

      for (const item of items) {
        if (allOffers.length >= maxOffers) break;
        if (seenIds.has(item.guid)) continue;

        // Filter by keywords
        const haystack = `${item.title} ${item.description}`.toLowerCase();
        if (!lowerKeywords.some(k => haystack.includes(k))) continue;

        seenIds.add(item.guid);
        allOffers.push(this.normalize(item));
      }
    }

    logger.info(`WeWorkRemotely: total ${allOffers.length} offers`);
    return allOffers;
  }

  private parseRss(xml: string): RssItem[] {
    const items: RssItem[] = [];
    const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];

    for (const block of itemMatches) {
      const get = (tag: string) =>
        block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))?.[1]?.trim()
        ?? block.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`))?.[1]?.trim()
        ?? '';

      const title = get('title');
      const link = (get('link') || block.match(/<link>([^<]+)<\/link>/)?.[1]?.trim()) ?? '';
      const guid = get('guid') || link;
      const description = get('description').replace(/<[^>]+>/g, ' ');
      const company = (get('dc:company') || title.split(' at ')?.[1]) ?? '';
      const pubDate = get('pubDate');

      if (title && link) {
        items.push({ title, link, pubDate, company, description, guid });
      }
    }
    return items;
  }

  private normalize(item: RssItem): JobOffer {
    const fullDescription = this.cleanText(item.description);
    // WWR titles often include company: "Job Title at Company Name"
    const [jobTitle, companyPart] = item.title.split(' at ');

    return {
      id: this.makeId(item.guid),
      portal: this.portal,
      portalJobId: item.guid,
      title: (jobTitle ?? item.title).trim(),
      company: (companyPart ?? item.company).trim(),
      location: 'Remote',
      workMode: 'remote',
      salary: null,
      skills: [],
      fullDescription,
      responsibilities: [],
      url: item.link,
      applyEmail: this.extractEmail(fullDescription),
      scrapedAt: new Date().toISOString(),
    };
  }
}
