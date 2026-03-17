import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { JobOffer } from '../types/index.js';
import { logger } from '../utils/index.js';

export interface EmailResult {
  sentTo: string;
  subject: string;
}

function buildCoverEmail(job: JobOffer, candidateName: string): string {
  return `Dear Hiring Team,

I am writing to express my interest in the ${job.title} position at ${job.company}.

After reviewing the job requirements, I believe my background and skills make me a strong candidate for this role. Please find my CV attached for your consideration.

I would welcome the opportunity to discuss how my experience aligns with your team's needs.

Best regards,
${candidateName}

---
Applied via JobHunter3 | ${job.url}
`;
}

export async function sendApplicationEmail(job: JobOffer): Promise<EmailResult> {
  const to = job.applyEmail ?? process.env['EMAIL_APPLY_FALLBACK'];
  if (!to) {
    throw new Error(
      `No apply email for job "${job.title}". Set EMAIL_APPLY_FALLBACK in .env or visit: ${job.url}`,
    );
  }

  const cvPath = path.resolve(process.env['CV_PDF_PATH'] ?? 'data/cv.pdf');
  if (!fs.existsSync(cvPath)) {
    throw new Error(`CV file not found at: ${cvPath}`);
  }

  const fromName = process.env['EMAIL_FROM_NAME'] ?? 'Job Applicant';
  const fromEmail = process.env['EMAIL_USER'];
  if (!fromEmail) throw new Error('EMAIL_USER is not set');

  const transporter = nodemailer.createTransport({
    host: process.env['EMAIL_SMTP_HOST'] ?? 'smtp.gmail.com',
    port: parseInt(process.env['EMAIL_SMTP_PORT'] ?? '587', 10),
    secure: false,
    auth: {
      user: fromEmail,
      pass: process.env['EMAIL_PASS'],
    },
  });

  const subject = `Application: ${job.title} at ${job.company}`;
  const cvFilename = path.basename(cvPath);

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    text: buildCoverEmail(job, fromName),
    attachments: [
      {
        filename: cvFilename,
        path: cvPath,
        contentType: 'application/pdf',
      },
    ],
  });

  logger.info(`Email sent: "${subject}" → ${to}`);
  return { sentTo: to, subject };
}
