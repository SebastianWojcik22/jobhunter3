import { CvVariant } from '../types/index.js';

/**
 * Builds the GPT-4o matching prompt.
 * ALL CV variants are passed simultaneously — GPT selects the best one AND scores it.
 * Job description is injected verbatim to prevent hallucination.
 */
export function buildMatchingPrompt(
  cvVariants: CvVariant[],
  jobTitle: string,
  jobFullDescription: string,
): string {
  const variantsSummary = cvVariants.map(v => ({
    id: v.id,
    role: v.role,
    language: v.language,
    skills: v.profile.skills,
    summary: v.profile.summary,
    roles: v.profile.roles.slice(0, 3).map(r => ({
      title: r.title,
      company: r.company,
      description: r.description.substring(0, 200),
    })),
    yearsExperience: v.profile.yearsExperience,
    languages: v.profile.languages,
  }));

  return `You are an expert technical recruiter evaluating a candidate for a job offer.

The candidate has multiple CV variants optimized for different roles. Your job is to:
1. Select the BEST matching CV variant for this job
2. Score how well that variant matches (0-100)
3. Identify any dealbreakers

CV VARIANTS AVAILABLE:
${JSON.stringify(variantsSummary, null, 2)}

CANDIDATE CONTEXT (applies to ALL variants):
- All projects are self-initiated — NO commercial employment history
- Development is AI-assisted (Claude Code, Cursor, ChatGPT) — NOT traditional software engineering
- Honest positioning: solution architect + AI tool operator, not a classical programmer
- Strong on: LLM integration, workflow automation, no-code/low-code, AI solution design, PM methodology
- Weak on: pure algorithmic coding, enterprise software, traditional development without AI tools

DEALBREAKERS (reduce score by 30+ points if ANY are present in the job):
- Requires 2+ years of commercial/professional experience (candidate has 0 commercial years)
- Requires coding independently without AI assistance tools
- Senior / Lead / Principal level only
- Requires enterprise tech not in any CV variant (SAP, Salesforce dev, Java, .NET, C++)
- Requires a formal CS/engineering degree as mandatory

JOB TITLE: ${jobTitle}

JOB DESCRIPTION:
---
${jobFullDescription}
---

Return ONLY valid JSON (no markdown, no explanation):
{
  "selectedCvId": "<id of best matching CV variant from the list above>",
  "score": <integer 0-100>,
  "rationale": "<3-5 sentences: which CV variant was chosen and why, key matches, gaps, any dealbreakers triggered>",
  "matchedSkills": ["<skills from selected CV that directly match job requirements>"],
  "missingSkills": ["<skills required by job that candidate lacks>"],
  "seniorityFit": "<junior|mid|senior|lead|unknown>",
  "dealbreakersFound": ["<each dealbreaker triggered, empty array if none>"],
  "alternativeCvId": "<id of second-best variant, or null>"
}

Scoring guide:
- 80-100: Strong match – right role, right skills, no dealbreakers, junior/mid level
- 60-79: Good match – mostly fits, minor gaps, no hard dealbreakers
- 40-59: Partial match – relevant background but notable gaps or soft dealbreakers
- 20-39: Poor match – significant gaps or 1 hard dealbreaker
- 0-19: No match – wrong domain or multiple hard dealbreakers

Base evaluation ONLY on the provided job description and CV data above. Do not infer requirements not stated.`;
}
