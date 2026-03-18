import { z } from 'zod';

export const SalaryRangeSchema = z.object({
  min: z.number().nullable(),
  max: z.number().nullable(),
  currency: z.string(),
  contractType: z.enum(['b2b', 'employment', 'mandate', 'internship', 'unknown']),
});

export const JobOfferSchema = z.object({
  id: z.string(),
  portal: z.enum(['justjoin', 'nofluffjobs', 'pracujpl', 'linkedin', 'remotive', 'himalayas', 'weworkremotely']),
  portalJobId: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string(),
  workMode: z.enum(['remote', 'hybrid', 'onsite', 'unknown']),
  salary: SalaryRangeSchema.nullable(),
  skills: z.array(z.string()),
  fullDescription: z.string(),
  responsibilities: z.array(z.string()),
  url: z.string().url(),
  applyEmail: z.string().email().nullable(),
  scrapedAt: z.string(),
});

export const CVProfileSchema = z.object({
  variantId: z.string(),
  candidateName: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  yearsExperience: z.number().nullable(),
  roles: z.array(z.object({
    title: z.string(),
    company: z.string(),
    startYear: z.number().nullable(),
    endYear: z.number().nullable(),
    description: z.string(),
  })),
  skills: z.array(z.string()),
  languages: z.array(z.string()),
  education: z.array(z.object({
    degree: z.string(),
    institution: z.string(),
    year: z.number().nullable(),
  })),
  summary: z.string().nullable(),
  parsedAt: z.string(),
});

export const MatchResultSchema = z.object({
  jobId: z.string(),
  portal: z.enum(['justjoin', 'nofluffjobs', 'pracujpl', 'linkedin', 'remotive', 'himalayas', 'weworkremotely']),
  selectedCvId: z.string(),
  detectedLanguage: z.enum(['en', 'pl']),
  detectedRole: z.enum(['developer', 'automation', 'pm']),
  score: z.number().min(0).max(100),
  isMatch: z.boolean(),
  rationale: z.string(),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  seniorityFit: z.enum(['junior', 'mid', 'senior', 'lead', 'unknown']),
  dealbreakersFound: z.array(z.string()),
  alternativeCvId: z.string().nullable(),
  matchedAt: z.string(),
});

/** Schema for the raw GPT-4o matching response (before we add jobId/portal/isMatch/matchedAt) */
export const MatchGptResponseSchema = z.object({
  selectedCvId: z.string(),
  score: z.number().min(0).max(100),
  rationale: z.string(),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  seniorityFit: z.enum(['junior', 'mid', 'senior', 'lead', 'unknown']),
  dealbreakersFound: z.array(z.string()).default([]),
  alternativeCvId: z.string().nullable().default(null),
});

/** Schema for the raw GPT-4o CV parsing response */
export const CVGptResponseSchema = z.object({
  candidateName: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  yearsExperience: z.number().nullable(),
  roles: z.array(z.object({
    title: z.string(),
    company: z.string(),
    startYear: z.number().nullable(),
    endYear: z.number().nullable(),
    description: z.string(),
  })),
  skills: z.array(z.string()),
  languages: z.array(z.string()),
  education: z.array(z.object({
    degree: z.string(),
    institution: z.string(),
    year: z.number().nullable(),
  })),
  summary: z.string().nullable(),
});
