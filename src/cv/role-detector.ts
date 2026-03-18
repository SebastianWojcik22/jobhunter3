import type { JobOffer, CvRole } from '../types/index.js';

/**
 * Keyword sets for each CV role.
 * Each keyword contributes +1 to the role's score.
 * The role with the highest score wins; ties broken by priority order: automation > developer > pm.
 */
const ROLE_KEYWORDS: Record<CvRole, string[]> = {
  aicreator: [
    'ai creator', 'prompt engineer', 'prompt engineering', 'inżynier promptów',
    'generative ai', 'generatywna ai', 'ai content', 'treści ai',
    'ai video', 'ai image', 'ai script', 'ai creative',
    'vibe coding', 'ai-assisted', 'ai assisted',
    'midjourney', 'dall-e', 'runway', 'kling', 'sora', 'pika',
    'storyboard', 'creative template', 'prompt library', 'biblioteka promptów',
    'ai advertising', 'ai marketing', 'ai copywriting',
    'llm prompt', 'prompt design', 'prompt optim',
    'ai storytelling', 'creative ai', 'ai content creator',
  ],
  automation: [
    'automation', 'automatyzacja', 'automatyk', 'automator',
    'rpa', 'robotic process', 'workflow', 'make.com', 'zapier', 'n8n',
    'integration', 'integracja', 'integrations', 'integracje',
    'process automation', 'automatyzacja procesów',
    'playwright', 'puppeteer', 'scraping', 'scraper', 'web scraping',
    'no-code', 'low-code', 'nocode', 'lowcode',
    'etl', 'pipeline', 'data pipeline', 'data flow',
    'webhook', 'api integration', 'system integration',
    'ipaas', 'middleware', 'connector',
  ],
  developer: [
    'developer', 'programista', 'engineer', 'inżynier oprogramowania',
    'software engineer', 'frontend', 'backend', 'fullstack', 'full-stack',
    'typescript', 'javascript', 'node.js', 'nodejs', 'react', 'vue', 'angular',
    'python', 'java', 'golang', 'rust', 'php',
    'ai developer', 'ai engineer', 'llm', 'gpt', 'openai', 'langchain',
    'prompt engineer', 'ai-assisted', 'ml engineer',
    'coding', 'programowanie', 'kod', 'aplikacja',
  ],
  pm: [
    'project manager', 'kierownik projektu', 'pm',
    'product manager', 'product owner', 'po',
    'scrum master', 'agile coach',
    'it manager', 'delivery manager', 'programme manager',
    'koordynator', 'coordinator', 'project coordinator',
    'sprint', 'backlog', 'roadmap', 'stakeholder',
    'pmo', 'portfolio', 'governance',
    'junior pm', 'associate pm',
  ],
};

/**
 * Classifies a job offer into one of 3 CV role categories.
 * Scores each role by keyword hits in title + description.
 * Falls back to 'developer' when no clear signal (most common role in job boards).
 */
export function detectJobRole(job: JobOffer): CvRole {
  const text = `${job.title} ${job.fullDescription} ${job.responsibilities.join(' ')} ${job.skills.join(' ')}`.toLowerCase();

  const scores: Record<CvRole, number> = { aicreator: 0, automation: 0, developer: 0, pm: 0 };

  for (const [role, keywords] of Object.entries(ROLE_KEYWORDS) as [CvRole, string[]][]) {
    for (const kw of keywords) {
      if (text.includes(kw)) scores[role]++;
    }
  }

  // Priority tiebreak: aicreator > automation > developer > pm
  const order: CvRole[] = ['aicreator', 'automation', 'developer', 'pm'];
  let best: CvRole = 'aicreator';
  let bestScore = -1;

  for (const role of order) {
    if (scores[role] > bestScore) {
      bestScore = scores[role];
      best = role;
    }
  }

  return best;
}
