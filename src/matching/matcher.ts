import OpenAI from 'openai';
import { JobOffer, CvVariant, MatchResult } from '../types/index.js';
import { MatchGptResponseSchema } from '../schemas/job-offer.schema.js';
import { buildMatchingPrompt } from './prompts.js';
import { logger, RateLimiter } from '../utils/index.js';

const rateLimiter = new RateLimiter(3000); // 3s between GPT-4o calls

export async function matchJobToVariants(
  job: JobOffer,
  cvVariants: CvVariant[],
  openai: OpenAI,
  model: string,
  threshold: number,
): Promise<MatchResult> {
  await rateLimiter.wait();

  const prompt = buildMatchingPrompt(cvVariants, job.title, job.fullDescription);

  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error(`GPT-4o returned empty response for job ${job.id}`);

  const raw = JSON.parse(content);
  const validated = MatchGptResponseSchema.parse(raw);

  // Resolve the selected variant (fall back to first if ID not found)
  const selectedVariant =
    cvVariants.find(v => v.id === validated.selectedCvId) ?? cvVariants[0]!;

  return {
    jobId: job.id,
    portal: job.portal,
    selectedCvId: selectedVariant.id,
    detectedLanguage: selectedVariant.language,
    detectedRole: selectedVariant.role,
    score: validated.score,
    isMatch: validated.score >= threshold,
    rationale: validated.rationale,
    matchedSkills: validated.matchedSkills,
    missingSkills: validated.missingSkills,
    seniorityFit: validated.seniorityFit,
    dealbreakersFound: validated.dealbreakersFound,
    alternativeCvId: validated.alternativeCvId,
    matchedAt: new Date().toISOString(),
  };
}

export async function batchMatch(
  jobs: JobOffer[],
  cvVariants: CvVariant[],
  openai: OpenAI,
  model: string,
  threshold: number,
  maxPerRun: number,
): Promise<MatchResult[]> {
  const toMatch = jobs.slice(0, maxPerRun);
  const results: MatchResult[] = [];

  logger.info(`Matching ${toMatch.length} jobs against ${cvVariants.length} CV variants (threshold: ${threshold}/100)...`);

  for (const job of toMatch) {
    try {
      const result = await matchJobToVariants(job, cvVariants, openai, model, threshold);
      results.push(result);
      if (result.isMatch) {
        logger.info(`Match: ${job.title} @ ${job.company} (score: ${result.score}, cv: ${result.selectedCvId})`, {
          portal: job.portal,
          score: result.score,
          cvVariant: result.selectedCvId,
          dealbreakers: result.dealbreakersFound,
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
