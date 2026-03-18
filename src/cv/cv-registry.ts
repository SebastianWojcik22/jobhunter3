import OpenAI from 'openai';
import path from 'path';
import type { CvVariantMeta, CVProfile, JobOffer, CvRole, CvLanguage } from '../types/index.js';
import { readJson, writeJson, logger } from '../utils/index.js';
import { extractTextFromPdf } from './pdf-reader.js';
import { parseCvWithAI } from './cv-parser.js';
import { detectJobLanguage } from './language-detector.js';
import { detectJobRole } from './role-detector.js';

const VARIANTS_CONFIG_PATH = path.resolve('data/cv-variants.json');
const PROFILES_DIR = path.resolve('data/cv-profiles');

/** Load variant definitions from data/cv-variants.json */
export function loadCvVariants(): CvVariantMeta[] {
  const variants = readJson<CvVariantMeta[]>(VARIANTS_CONFIG_PATH);
  if (!variants || variants.length === 0) {
    throw new Error(`No CV variants found at ${VARIANTS_CONFIG_PATH}. Run: npm run parse-all-cvs`);
  }
  return variants;
}

/** Load a cached CVProfile for a specific variant, or null if not yet parsed */
export function loadCachedVariantProfile(variantId: string): CVProfile | null {
  const profilePath = path.join(PROFILES_DIR, `${variantId}.json`);
  return readJson<CVProfile>(profilePath);
}

/** Parse a CV PDF and cache the resulting profile for a specific variant */
export async function parseAndCacheVariant(
  meta: CvVariantMeta,
  openai: OpenAI,
  model: string,
): Promise<CVProfile> {
  logger.info('Parsing CV variant', { variantId: meta.id, pdfPath: meta.pdfPath });
  const rawText = await extractTextFromPdf(path.resolve(meta.pdfPath));
  const profile = await parseCvWithAI(rawText, openai, model, meta.id);

  // Inject variantId into the profile
  const profileWithMeta: CVProfile = { ...profile, variantId: meta.id };

  const profilePath = path.resolve(meta.profilePath);
  writeJson(profilePath, profileWithMeta);
  logger.info('CV variant profile saved', { variantId: meta.id, path: profilePath });

  return profileWithMeta;
}

/** Load all 6 CV profiles (from cache if available, parse otherwise) */
export async function loadAllCvProfiles(
  openai: OpenAI,
  model: string,
): Promise<Map<string, CVProfile>> {
  const variants = loadCvVariants();
  const profiles = new Map<string, CVProfile>();

  for (const meta of variants) {
    const cached = loadCachedVariantProfile(meta.id);
    if (cached) {
      logger.info('Using cached CV variant', { variantId: meta.id, candidateName: cached.candidateName });
      profiles.set(meta.id, cached);
    } else {
      const profile = await parseAndCacheVariant(meta, openai, model);
      profiles.set(meta.id, profile);
    }
  }

  logger.info('All CV variants loaded', { count: profiles.size });
  return profiles;
}

/**
 * Select the best CV variant for a given job offer.
 * Detection order:
 *   1. Detect job language (en/pl)
 *   2. Detect job role (developer/automation/pm)
 *   3. Return variantId = `${role}-${language}`
 */
export function selectBestCv(
  job: JobOffer,
  profiles: Map<string, CVProfile>,
): { variantId: string; profile: CVProfile; language: CvLanguage; role: CvRole } {
  const language = detectJobLanguage(job);
  const role = detectJobRole(job);
  const variantId = `${role}-${language}`;

  const profile = profiles.get(variantId);
  if (profile) {
    logger.info('CV variant selected', { jobTitle: job.title, variantId, language, role });
    return { variantId, profile, language, role };
  }

  // Fallback: same role but English CV
  const fallbackId = `${role}-en`;
  const fallbackProfile = profiles.get(fallbackId);
  if (fallbackProfile) {
    logger.warn('CV variant not found, falling back to EN', { variantId, fallbackId });
    return { variantId: fallbackId, profile: fallbackProfile, language: 'en', role };
  }

  // Last resort: first available profile
  const firstEntry = profiles.entries().next().value as [string, CVProfile];
  logger.warn('Using first available CV variant as last resort', { variantId: firstEntry[0] });
  return { variantId: firstEntry[0], profile: firstEntry[1], language, role };
}
