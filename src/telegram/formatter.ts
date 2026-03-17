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
  const responsibilities = job.responsibilities.slice(0, 3);
  const salary = formatSalary(job);
  const workMode = workModeIcon(job.workMode);

  const lines: string[] = [
    `*${escapeMarkdown(job.title)}*`,
    `🏢 ${escapeMarkdown(job.company)}`,
    `${workMode} | 📍 ${escapeMarkdown(job.location)}`,
    `💰 ${salary}`,
    `🎯 Match score: *${match.score}/100* | via ${portal}`,
    '',
    `*Skills required:* ${escapeMarkdown(skills)}`,
  ];

  if (responsibilities.length > 0) {
    lines.push('', '*Responsibilities:*');
    for (const r of responsibilities) {
      lines.push(`• ${escapeMarkdown(r)}`);
    }
  }

  lines.push('', `*Why it fits:* ${escapeMarkdown(match.rationale)}`);

  if (match.missingSkills.length > 0) {
    lines.push(`⚠️ *Missing:* ${escapeMarkdown(match.missingSkills.slice(0, 4).join(', '))}`);
  }

  return lines.join('\n');
}

/** Escape Telegram MarkdownV2 special characters */
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, c => `\\${c}`);
}
