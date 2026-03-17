import crypto from 'crypto';
import { JobOffer, Portal } from '../types/index.js';

export abstract class BaseScraper {
  abstract readonly portal: Portal;

  abstract fetchOffers(keywords: string[], maxOffers: number): Promise<JobOffer[]>;

  protected makeId(portalJobId: string): string {
    return crypto.createHash('sha256').update(`${this.portal}::${portalJobId}`).digest('hex');
  }

  protected cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  protected extractEmail(text: string): string | null {
    const match = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    return match?.[0] ?? null;
  }
}
