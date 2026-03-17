import 'dotenv/config';
import OpenAI from 'openai';
import path from 'path';
import { parseCv } from '../src/cv/index.js';
import { logger } from '../src/utils/index.js';

const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });
const model = process.env['OPENAI_MODEL'] ?? 'gpt-4o';
const cvPath = path.resolve(process.env['CV_PDF_PATH'] ?? 'data/cv.pdf');

logger.info(`Parsing CV from: ${cvPath}`);

parseCv(cvPath, openai, model)
  .then(profile => {
    logger.info('Done!', {
      name: profile.candidateName,
      skills: profile.skills.length,
      roles: profile.roles.length,
    });
    console.log('\nParsed CV Profile:');
    console.log(JSON.stringify(profile, null, 2));
  })
  .catch(err => {
    logger.error('Failed to parse CV', { error: err instanceof Error ? err.message : String(err) });
    process.exit(1);
  });
