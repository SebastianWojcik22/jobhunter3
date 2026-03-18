import type { JobOffer, CvLanguage } from '../types/index.js';

/**
 * Polish-language signal words that appear frequently in PL job postings.
 * Deliberately broad — false-positive PL is safer than false-positive EN
 * (worst case: we send a Polish CV to a Polish job instead of English).
 */
const PL_SIGNALS = [
  'wymagania', 'obowiązki', 'oferujemy', 'umiejętności', 'doświadczenie',
  'praca', 'stanowisko', 'zatrudnienie', 'współpraca', 'zespół', 'firma',
  'wynagrodzenie', 'benefity', 'aplikuj', 'rekrutacja', 'kandydat',
  'znajomość', 'mile widziane', 'poszukujemy', 'dołącz', 'zapraszamy',
  'odpowiedzialności', 'zakres', 'będziesz', 'oczekujemy', 'oferujemy',
  'języki', 'miejsce pracy', 'forma zatrudnienia', 'ogłoszenie',
];

/** Minimum ratio of PL signal hits to total words to classify as Polish */
const PL_THRESHOLD = 0.015; // ~1.5% of words must be PL signals

/**
 * Detects the primary language of a job offer.
 * Uses lightweight keyword scoring — no external API needed.
 * Falls back to 'en' when signal is ambiguous.
 */
export function detectJobLanguage(job: JobOffer): CvLanguage {
  const text = `${job.title} ${job.company} ${job.fullDescription} ${job.responsibilities.join(' ')}`.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length === 0) return 'en';

  let plHits = 0;
  for (const signal of PL_SIGNALS) {
    if (text.includes(signal)) plHits++;
  }

  const ratio = plHits / words.length;
  return ratio >= PL_THRESHOLD ? 'pl' : 'en';
}
