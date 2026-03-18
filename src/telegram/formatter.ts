import { JobOffer, MatchResult } from '../types/index.js';

const PORTAL_LABEL: Record<string, string> = {
  justjoin: 'JustJoin.it',
  nofluffjobs: 'NoFluffJobs',
  pracujpl: 'Pracuj.pl',
  linkedin: 'LinkedIn',
};

function formatSalary(job: JobOffer): string {
  if (!job.salary) return 'Salary not specified';
  const { min, max, currency } = job.salary;
  if (min && max) return `${min.toLocaleString()}–${max.toLocaleString()} ${currency}`;
  if (min) return `from ${min.toLocaleString()} ${currency}`;
  if (max) return `up to ${max.toLocaleString()} ${currency}`;
  return 'Salary not specified';
}

function workModeIcon(mode: string): string {
  switch (mode) {
    case 'remote': return '🌍 Remote';
    case 'hybrid': return '🔀 Hybrid';
    case 'onsite': return '🏢 On-site';
    default: return '📍 Location TBD';
  }
}

export function formatJobNotification(job: JobOffer, match: MatchResult): string {
  const portal = PORTAL_LABEL[job.portal] ?? job.portal;
  const skills = job.skills.slice(0, 8).join(', ') || 'Not specified';
  const salary = formatSalary(job);
  const workMode = workModeIcon(job.workMode);
  const cvLabel = formatCvVariant(match.selectedCvId);

  const e = escapeHtml;

  const lines: string[] = [
    `<b>${e(job.title)}</b>`,
    `🏢 ${e(job.company)}`,
    `${e(workMode)} | 📍 ${e(job.location)}`,
    `💰 ${e(salary)}`,
    `🎯 Match score: <b>${match.score}/100</b> | via ${e(portal)}`,
    `📄 CV: ${e(cvLabel)}`,
    '',
    `<b>Skills:</b> ${e(skills)}`,
  ];

  lines.push('', `<b>Why it fits:</b> ${e(match.rationale)}`);

  if (match.missingSkills.length > 0) {
    lines.push(`⚠️ <b>Missing:</b> ${e(match.missingSkills.slice(0, 4).join(', '))}`);
  }

  return lines.join('\n');
}

/** Human-readable label for a CV variant ID like 'developer-en' */
function formatCvVariant(variantId: string): string {
  const labels: Record<string, string> = {
    'developer-en': 'AI Solutions Builder (EN)',
    'developer-pl': 'AI Solutions Builder (PL)',
    'automation-en': 'Automation Specialist (EN)',
    'automation-pl': 'Automation Specialist (PL)',
    'pm-en': 'Junior IT Project Manager (EN)',
    'pm-pl': 'Junior IT Project Manager (PL)',
  };
  return labels[variantId] ?? variantId;
}

/** Escape HTML entities for Telegram HTML parse mode */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
