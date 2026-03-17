import OpenAI from 'openai';
import path from 'path';
import { CVProfile } from '../types/index.js';
import { readJson, writeJson, logger } from '../utils/index.js';
import { extractTextFromPdf } from './pdf-reader.js';
import { parseCvWithAI } from './cv-parser.js';

const CV_PROFILE_PATH = path.resolve('data/cv-profile.json');

export async function parseCv(pdfPath: string, openai: OpenAI, model: string): Promise<CVProfile> {
  const rawText = await extractTextFromPdf(pdfPath);
  const profile = await parseCvWithAI(rawText, openai, model);
  writeJson(CV_PROFILE_PATH, profile);
  logger.info('CV profile saved', { path: CV_PROFILE_PATH });
  return profile;
}

export function loadCachedProfile(): CVProfile | null {
  return readJson<CVProfile>(CV_PROFILE_PATH);
}

export async function getOrParseCv(pdfPath: string, openai: OpenAI, model: string): Promise<CVProfile> {
  const cached = loadCachedProfile();
  if (cached) {
    logger.info('Using cached CV profile', { candidateName: cached.candidateName });
    return cached;
  }
  return parseCv(pdfPath, openai, model);
}
