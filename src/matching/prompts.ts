import { CVProfile } from '../types/index.js';

/**
 * Builds the GPT-4o matching prompt.
 *
 * ANTI-HALLUCINATION RULE: the full job description is ALWAYS injected
 * verbatim between --- delimiters. The model must base its evaluation
 * solely on the provided text.
 */
export function buildMatchingPrompt(cvProfile: CVProfile, jobTitle: string, jobFullDescription: string): string {
  const candidateSummary = JSON.stringify({
    name: cvProfile.candidateName,
    yearsExperience: cvProfile.yearsExperience,
    skills: cvProfile.skills,
    languages: cvProfile.languages,
    roles: cvProfile.roles.slice(0, 3).map(r => ({
      title: r.title,
      company: r.company,
      description: r.description.substring(0, 300),
    })),
    summary: cvProfile.summary,
  }, null, 2);

  return `You are an expert technical recruiter. Evaluate how well the candidate matches this job offer.

CANDIDATE PROFILE:
${candidateSummary}

JOB TITLE: ${jobTitle}

JOB DESCRIPTION:
---
${jobFullDescription}
---

Return ONLY valid JSON (no markdown, no explanation):
{
  "score": <integer 0-100>,
  "rationale": "<2-4 plain-language sentences explaining why this is or isn't a good match>",
  "matchedSkills": ["<skills from candidate that match job requirements>"],
  "missingSkills": ["<skills required by job that candidate lacks>"],
  "seniorityFit": "<junior|mid|senior|lead|unknown>"
}

Scoring guide:
- 80-100: Strong match – most required skills present, right seniority level
- 60-79: Good match – most skills present, minor gaps or slight seniority mismatch
- 40-59: Partial match – relevant background but significant skill gaps
- 0-39: Poor match – different domain or most required skills missing

Base your evaluation ONLY on the provided job description text and candidate profile.
Do not infer or assume requirements not mentioned in the text.`;
}
