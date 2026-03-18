import OpenAI from 'openai';
import path from 'path';
import { CVProfile } from '../types/index.js';
import { readJson, writeJson, logger } from '../utils/index.js';
import { extractTextFromPdf } from './pdf-reader.js';
import { parseCvWithAI } from './cv-parser.js';

// Legacy single-CV support (kept for backwards compatibility with existing scripts)
const CV_PROFILE_PATH = path.resolve('data/cv-profile.json');

export async function parseCv(pdfPath: string, openai: OpenAI, model: string, variantId = 'default'): Promise<CVProfile> {
  const rawText = await extractTextFromPdf(pdfPath);
  const profile = await parseCvWithAI(rawText, openai, model, variantId);
  writeJson(CV_PROFILE_PATH, profile);
  logger.info('CV profile saved', { path: CV_PROFILE_PATH });
  return profile;
}

export function loadCachedProfile(): CVProfile | null {
  return readJson<CVProfile>(CV_PROFILE_PATH);
}

export async function getOrParseCv(pdfPath: string, openai: OpenAI, model: string, variantId = 'default'): Promise<CVProfile> {
  const cached = loadCachedProfile();
  if (cached) {
    logger.info('Using cached CV profile', { candidateName: cached.candidateName });
    return cached;
  }
  return parseCv(pdfPath, openai, model, variantId);
}

// Re-export registry functions for convenience
export { loadAllCvProfiles, selectBestCv, loadCvVariants } from './cv-registry.js';
