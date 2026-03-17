import OpenAI from 'openai';
import { JobOffer, CVProfile, MatchResult } from '../types/index.js';
import { MatchGptResponseSchema } from '../schemas/job-offer.schema.js';
import { buildMatchingPrompt } from './prompts.js';
import { logger, RateLimiter } from '../utils/index.js';

const rateLimiter = new RateLimiter(3000); // 3s between GPT-4o calls

export async function matchJobToCv(
  job: JobOffer,
  cvProfile: CVProfile,
  openai: OpenAI,
  model: string,
  threshold: number,
): Promise<MatchResult> {
  await rateLimiter.wait();

  const prompt = buildMatchingPrompt(cvProfile, job.title, job.fullDescription);

  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error(`GPT-4o returned empty response for job ${job.id}`);
  }

  const raw = JSON.parse(content);
  const validated = MatchGptResponseSchema.parse(raw);

  return {
    jobId: job.id,
    portal: job.portal,
    score: validated.score,
    isMatch: validated.score >= threshold,
    rationale: validated.rationale,
    matchedSkills: validated.matchedSkills,
    missingSkills: validated.missingSkills,
    seniorityFit: validated.seniorityFit,
    matchedAt: new Date().toISOString(),
  };
}

export async function batchMatch(
  jobs: JobOffer[],
  cvProfile: CVProfile,
  openai: OpenAI,
  model: string,
  threshold: number,
  maxPerRun: number,
): Promise<MatchResult[]> {
  const toMatch = jobs.slice(0, maxPerRun);
  const results: MatchResult[] = [];

  logger.info(`Matching ${toMatch.length} jobs against CV (threshold: ${threshold}/100)...`);

  for (let i = 0; i < toMatch.length; i++) {
    const job = toMatch[i];
    if (!job) continue;
    try {
      const result = await matchJobToCv(job, cvProfile, openai, model, threshold);
      results.push(result);
      if (result.isMatch) {
        logger.info(`Match found: ${job.title} @ ${job.company} (score: ${result.score})`, {
          portal: job.portal,
          score: result.score,
        });
      }
    } catch (err) {
      logger.warn(`Failed to match job ${job.id}`, {
        title: job.title,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const matches = results.filter(r => r.isMatch);
  logger.info(`Matching complete: ${matches.length}/${toMatch.length} matches found`);
  return results;
}
