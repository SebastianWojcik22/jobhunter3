import path from 'path';
import { JobOffer } from '../types/index.js';
import { readJson, writeJson, logger } from '../utils/index.js';

const SEEN_JOBS_PATH = path.resolve('data/seen-jobs.json');

let seenHashes: Set<string> | null = null;

function getSet(): Set<string> {
  if (!seenHashes) {
    const stored = readJson<string[]>(SEEN_JOBS_PATH);
    seenHashes = new Set(stored ?? []);
    logger.info(`Dedup: loaded ${seenHashes.size} seen job hashes`);
  }
  return seenHashes;
}

export function isAlreadySeen(offer: JobOffer): boolean {
  return getSet().has(offer.id);
}

export function filterNew(offers: JobOffer[]): { newOffers: JobOffer[]; duplicateCount: number } {
  const set = getSet();
  const newOffers = offers.filter(o => !set.has(o.id));
  const duplicateCount = offers.length - newOffers.length;
  return { newOffers, duplicateCount };
}

export function markAsSeen(offers: JobOffer[]): void {
  const set = getSet();
  for (const offer of offers) {
    set.add(offer.id);
  }
  writeJson(SEEN_JOBS_PATH, Array.from(set));
}

/** Reset in-memory cache (useful for testing). */
export function resetCache(): void {
  seenHashes = null;
}
