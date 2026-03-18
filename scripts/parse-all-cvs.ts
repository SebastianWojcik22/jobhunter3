import 'dotenv/config';
import OpenAI from 'openai';
import { loadCvVariants, parseAndCacheVariant, loadCachedVariantProfile } from '../src/cv/cv-registry.js';
import { logger } from '../src/utils/index.js';

const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });
const model = process.env['OPENAI_MODEL'] ?? 'gpt-4o';
const forceReparse = process.argv.includes('--force');

async function main() {
  const variants = loadCvVariants();
  logger.info(`Found ${variants.length} CV variants to process`, { force: forceReparse });

  let parsed = 0;
  let skipped = 0;

  for (const meta of variants) {
    const cached = !forceReparse ? loadCachedVariantProfile(meta.id) : null;

    if (cached) {
      logger.info(`[SKIP] ${meta.id} — already cached`, { candidateName: cached.candidateName });
      skipped++;
      continue;
    }

    logger.info(`[PARSE] ${meta.id} — ${meta.pdfPath}`);
    const profile = await parseAndCacheVariant(meta, openai, model);
    logger.info(`[DONE] ${meta.id}`, {
      candidateName: profile.candidateName,
      skills: profile.skills.length,
    });
    parsed++;
  }

  logger.info(`\nAll done! Parsed: ${parsed} | Skipped (cached): ${skipped}`);
  logger.info('Run "npm run scan" to start the first scan with all CV variants.');
}

main().catch(err => {
  logger.error('Failed to parse CVs', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
