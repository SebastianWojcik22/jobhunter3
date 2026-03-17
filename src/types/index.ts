export type Portal = 'justjoin' | 'nofluffjobs' | 'pracujpl' | 'linkedin';

export type WorkMode = 'remote' | 'hybrid' | 'onsite' | 'unknown';

export type ContractType = 'b2b' | 'employment' | 'mandate' | 'internship' | 'unknown';

export interface SalaryRange {
  min: number | null;
  max: number | null;
  currency: string;
  contractType: ContractType;
}

/**
 * Canonical job offer representation produced by all scrapers.
 * id = SHA-256(portal + portalJobId) – used as the deduplication key.
 */
export interface JobOffer {
  /** Dedup key: SHA-256(portal + portalJobId) */
  id: string;
  portal: Portal;
  /** Job ID as given by the portal (slug, numeric ID, UUID, etc.) */
  portalJobId: string;
  title: string;
  company: string;
  location: string;
  workMode: WorkMode;
  salary: SalaryRange | null;
  skills: string[];
  /**
   * Full job description text.
   * INJECTED VERBATIM into the matching prompt – never truncated or summarised.
   */
  fullDescription: string;
  responsibilities: string[];
  url: string;
  /** Direct apply email extracted from the listing, or null. */
  applyEmail: string | null;
  /** ISO 8601 */
  scrapedAt: string;
}

/**
 * Structured candidate profile parsed from a CV PDF by GPT-4o.
 * Cached to data/cv-profile.json after the first parse.
 */
export interface CVProfile {
  candidateName: string;
  email: string;
  phone: string | null;
  location: string | null;
  yearsExperience: number | null;
  roles: Array<{
    title: string;
    company: string;
    startYear: number | null;
    endYear: number | null;
    description: string;
  }>;
  skills: string[];
  languages: string[];
  education: Array<{
    degree: string;
    institution: string;
    year: number | null;
  }>;
  summary: string | null;
  /** ISO 8601 */
  parsedAt: string;
}

/**
 * Result of one GPT-4o matching call: one CVProfile vs. one JobOffer.
 */
export interface MatchResult {
  jobId: string;
  portal: Portal;
  /** 0–100 */
  score: number;
  /** true when score >= MATCH_THRESHOLD */
  isMatch: boolean;
  /** 2–4 plain-language sentences explaining the match/mismatch */
  rationale: string;
  matchedSkills: string[];
  missingSkills: string[];
  seniorityFit: 'junior' | 'mid' | 'senior' | 'lead' | 'unknown';
  /** ISO 8601 */
  matchedAt: string;
}

/**
 * Summary of one full scan cycle logged after completion.
 */
export interface ScanRunSummary {
  runId: string;
  startedAt: string;
  completedAt: string;
  portalsScanned: Portal[];
  totalFetched: number;
  newJobs: number;
  duplicatesSkipped: number;
  matchesFound: number;
  notificationsSent: number;
  errors: Array<{ portal: Portal; message: string }>;
}

/**
 * In-memory record of a pending "Apply via Email" action triggered from Telegram.
 * Keyed by job.id in the pendingJobsMap.
 */
export interface PendingApply {
  jobId: string;
  job: JobOffer;
  matchResult: MatchResult;
  chatId: number;
  requestedAt: string;
}
