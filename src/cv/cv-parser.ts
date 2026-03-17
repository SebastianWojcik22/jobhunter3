import OpenAI from 'openai';
import { CVProfile } from '../types/index.js';
import { CVGptResponseSchema } from '../schemas/job-offer.schema.js';
import { buildCvParsingPrompt } from './prompts.js';
import { logger } from '../utils/index.js';

export async function parseCvWithAI(rawText: string, openai: OpenAI, model: string): Promise<CVProfile> {
  logger.info('Parsing CV with GPT-4o...');

  const prompt = buildCvParsingPrompt(rawText);

  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('GPT-4o returned empty response for CV parsing');
  }

  const parsed = JSON.parse(content);
  const validated = CVGptResponseSchema.parse(parsed);

  const profile: CVProfile = {
    ...validated,
    parsedAt: new Date().toISOString(),
  };

  logger.info('CV parsed successfully', { candidateName: profile.candidateName, skills: profile.skills.length });
  return profile;
}
