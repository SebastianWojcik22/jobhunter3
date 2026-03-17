# JobHunter3

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?logo=openai&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-1.x-2EAD33?logo=playwright&logoColor=white)
![Telegram](https://img.shields.io/badge/Telegram-Bot-26A5E4?logo=telegram&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

> **AI-powered job search automation** – scans multiple job boards, semantically matches offers to your CV using GPT-4o, and lets you apply with a single click from Telegram.

---

## What it does

1. **Scrapes** four job portals on a configurable schedule (hourly by default)
2. **Parses your CV** (PDF) into a structured profile using GPT-4o
3. **Semantically matches** each job offer against your profile — no keyword hacks, real language understanding
4. **Notifies you on Telegram** with salary, skills, location, and a match score
5. **Sends your CV by email** with one tap on the Telegram inline button

---

## Features

- **Multi-portal scraping** – JustJoin.it (public API), NoFluffJobs (JSON API), Pracuj.pl (Playwright), LinkedIn (Playwright stealth)
- **GPT-4o semantic matching** – scores 0–100 with rationale, matched skills, missing skills, and seniority fit
- **Anti-hallucination** – full job description always injected verbatim into the prompt; model cannot infer from memory
- **Deduplication** – SHA-256 fingerprinting prevents re-alerting on already-seen offers
- **One-click apply** – Telegram inline button triggers nodemailer to send your CV as a PDF attachment
- **Cost control** – configurable cap on GPT-4o calls per scan run (`MATCH_MAX_PER_RUN`)
- **Fault isolation** – LinkedIn scraper failures never break other portal scans
- **CV caching** – CV parsed once and cached; re-parsed only when you run `npm run parse-cv`
- **Cron scheduler** – runs unattended; configurable via standard cron expression

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Job Portals                                            │
│  JustJoin.it ──(JSON API)──┐                            │
│  NoFluffJobs ──(JSON API)──┤                            │
│  Pracuj.pl   ──(Playwright)┤→  JobOffer[]               │
│  LinkedIn    ──(Playwright)┘                            │
└───────────────────────────────────────┬─────────────────┘
                                        │
                              ┌─────────▼──────────┐
                              │  Deduplication     │
                              │  SHA-256 filter    │
                              └─────────┬──────────┘
                                        │ new offers only
                    ┌───────────────────▼───────────────────┐
                    │  GPT-4o Semantic Matching              │
                    │  CVProfile × JobOffer → score 0–100   │
                    │  rationale · matched/missing skills    │
                    └───────────────────┬───────────────────┘
                                        │ score ≥ threshold
                              ┌─────────▼──────────┐
                              │  Telegram Bot      │
                              │  [View Job]        │
                              │  [Apply via Email] │
                              └─────────┬──────────┘
                                        │ user taps button
                              ┌─────────▼──────────┐
                              │  nodemailer        │
                              │  CV PDF attached   │
                              └────────────────────┘
```

---

## Tech Stack

| Technology | Role |
|-----------|------|
| **TypeScript 5 + Node.js 20** | Core runtime, strict mode |
| **OpenAI GPT-4o** | CV parsing + semantic job matching |
| **Playwright** | Headless browser scraping (Pracuj.pl, LinkedIn) |
| **pdf-parse** | Extract text from CV PDF |
| **node-telegram-bot-api** | Telegram Bot notifications + inline keyboard |
| **nodemailer** | Send application emails with CV attachment |
| **node-cron** | Scheduled scan execution |
| **Zod** | Runtime schema validation for all external data |
| **uuid** | Unique scan run identifiers |

---

## Project Structure

```
src/
├── types/index.ts           # Shared TypeScript interfaces (source of truth)
├── schemas/                 # Zod runtime validation schemas
├── scrapers/                # One module per portal + base class
│   ├── base-scraper.ts      # Abstract BaseScraper with shared utilities
│   ├── justjoin-scraper.ts  # JustJoin.it public JSON API
│   ├── nofluffjobs-scraper.ts
│   ├── pracujpl-scraper.ts  # Playwright HTML scraper
│   └── linkedin-scraper.ts  # Playwright stealth (fault-isolated)
├── cv/                      # CV PDF → CVProfile (GPT-4o, cached)
├── matching/                # GPT-4o match scoring with anti-hallucination prompt
├── dedup/                   # SHA-256 deduplication store
├── telegram/                # Bot, message formatter, callback handlers
├── email/                   # nodemailer one-click apply
├── pipeline/                # Scan orchestrator (fetch → dedup → match → notify)
├── scheduler/               # node-cron wrapper
└── utils/                   # Logger, retry, rate limiter, file store

scripts/
├── parse-cv.ts              # One-shot: PDF → data/cv-profile.json
├── run-scan.ts              # Manual single scan cycle
└── start-scheduler.ts       # Start daemon (cron + Telegram bot)
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- OpenAI API key (GPT-4o access)
- Telegram Bot token ([create one via @BotFather](https://t.me/BotFather))
- Gmail account with [App Password](https://myaccount.google.com/apppasswords) (for email apply)

### Setup

```bash
git clone https://github.com/SebastianWojcik22/jobhunter3.git
cd jobhunter3

npm install
npx playwright install chromium
```

### Configure

```bash
cp .env.example .env
# Edit .env with your API keys (see Configuration section below)
```

Place your CV at `data/cv.pdf`.

### Run

```bash
# Step 1: Parse your CV (run once; result cached in data/cv-profile.json)
npm run parse-cv

# Step 2: Run a manual one-shot scan
npm run scan

# Step 3: Start the scheduler (scans every hour, keeps Telegram bot alive)
npm run start
```

---

## Configuration

Copy `.env.example` to `.env` and fill in the values:

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | required |
| `OPENAI_MODEL` | Model to use | `gpt-4o` |
| `TELEGRAM_BOT_TOKEN` | Token from @BotFather | required |
| `TELEGRAM_CHAT_ID` | Your personal chat ID (get from @userinfobot) | required |
| `EMAIL_USER` | Gmail address | required |
| `EMAIL_PASS` | Gmail App Password | required |
| `EMAIL_FROM_NAME` | Display name in sent emails | required |
| `CV_PDF_PATH` | Path to your CV PDF | `data/cv.pdf` |
| `MATCH_THRESHOLD` | Minimum score to send notification (0–100) | `60` |
| `MATCH_MAX_PER_RUN` | Max GPT-4o calls per scan (cost control) | `50` |
| `SCRAPER_KEYWORDS` | Comma-separated filter keywords | `typescript,node.js` |
| `ENABLED_PORTALS` | Portals to scrape | `justjoin,nofluffjobs,pracujpl,linkedin` |
| `SCAN_CRON` | Cron expression for scheduled scans | `0 * * * *` (hourly) |
| `LINKEDIN_SEARCH_URL` | Pre-filtered LinkedIn search URL | optional |
| `PLAYWRIGHT_HEADLESS` | Run browser headless | `true` |

---

## How It Works

### 1. CV Parsing (one-time)
Your PDF is read by `pdf-parse`, the raw text is sent to GPT-4o with a structured extraction prompt. The result — a `CVProfile` with skills, roles, languages, and education — is cached locally and reused on every scan.

### 2. Job Scraping
Each enabled portal runs its own scraper:
- **JustJoin.it / NoFluffJobs**: Pure HTTP requests to their public JSON APIs
- **Pracuj.pl / LinkedIn**: Playwright navigates the search page, extracts offer cards

### 3. Deduplication
Every offer is fingerprinted as `SHA-256(portal + portalJobId)`. Seen hashes are stored in `data/seen-jobs.json`. Already-seen offers are silently skipped — they will never trigger a notification again, even if they reappear weeks later.

### 4. Semantic Matching
For each new offer, one GPT-4o call compares your `CVProfile` against the full job description (injected verbatim — no summarisation, no risk of hallucination). The model returns a score (0–100), a plain-language rationale, matched and missing skills, and a seniority fit assessment. Only offers scoring ≥ `MATCH_THRESHOLD` trigger a notification.

### 5. Notification & Apply
A Telegram message is sent with the job's key details and two buttons: **View Job** (opens URL) and **Apply via Email**. Tapping the latter sends an email with your CV PDF attached via SMTP — no browser needed.

---

## Example Output

### Telegram notification (what you receive on your phone)

```
Senior Node.js Developer at Acme Corp
🏢 Acme Corp
🌍 Remote | 📍 Warsaw
💰 18,000–24,000 PLN
🎯 Match score: 82/100 | via JustJoin.it

Skills required: Node.js, TypeScript, REST APIs, PostgreSQL, Docker

Responsibilities:
• Build and maintain backend microservices
• Design REST and GraphQL APIs
• Participate in architecture decisions

Why it fits: Strong match — candidate has 3 years of Node.js and TypeScript
experience with REST API design, which directly covers the core requirements.
PostgreSQL is listed in candidate's skills. Docker experience mentioned in
recent role. Missing Kubernetes (nice-to-have, not blocking).

⚠️ Missing: Kubernetes

[ 🔗 View Job ]  [ 📧 Apply via Email ]
```

### GPT-4o matching result (saved to `data/match-results/`)

```json
{
  "jobId": "a3f9c2d1e4b7...",
  "portal": "justjoin",
  "score": 82,
  "isMatch": true,
  "rationale": "Strong match — candidate has 3 years of Node.js and TypeScript experience with REST API design, which directly covers the core requirements. PostgreSQL is listed in candidate's skills. Docker experience mentioned in recent role. Missing Kubernetes (nice-to-have, not blocking).",
  "matchedSkills": ["Node.js", "TypeScript", "REST APIs", "PostgreSQL", "Docker"],
  "missingSkills": ["Kubernetes"],
  "seniorityFit": "mid",
  "matchedAt": "2025-07-14T10:32:11.000Z"
}
```

### Parsed CV profile (`data/cv-profile.json`)

```json
{
  "candidateName": "Jan Kowalski",
  "email": "jan@example.com",
  "yearsExperience": 3,
  "skills": ["TypeScript", "Node.js", "React", "PostgreSQL", "Docker", "REST APIs"],
  "roles": [
    {
      "title": "Backend Developer",
      "company": "TechStartup Sp. z o.o.",
      "startYear": 2022,
      "endYear": null,
      "description": "Built REST APIs using Node.js and TypeScript..."
    }
  ],
  "languages": ["Polish (native)", "English (B2)"],
  "parsedAt": "2025-07-14T09:00:00.000Z"
}
```

### Scan run summary (console output)

```
[2025-07-14T10:30:00Z] [INFO] === Scan run started: 9f3a1b2c ===
[2025-07-14T10:30:01Z] [INFO] Using cached CV profile { candidateName: 'Jan Kowalski' }
[2025-07-14T10:30:04Z] [INFO] JustJoin: got 9842 total offers
[2025-07-14T10:30:04Z] [INFO] JustJoin: 143 offers after keyword filter
[2025-07-14T10:30:07Z] [INFO] NoFluffJobs: got 67 offers
[2025-07-14T10:30:15Z] [INFO] Pracuj.pl: scraped 38 offers
[2025-07-14T10:30:18Z] [INFO] LinkedIn: scraping failed (isolated) { error: 'auth wall detected' }
[2025-07-14T10:30:18Z] [INFO] New offers: 31 | Duplicates skipped: 217
[2025-07-14T10:30:18Z] [INFO] Matching 31 jobs against CV (threshold: 60/100)...
[2025-07-14T10:32:44Z] [INFO] Match found: Senior Node.js Developer @ Acme Corp (score: 82)
[2025-07-14T10:32:51Z] [INFO] Match found: Full Stack Engineer @ FinTech SA (score: 71)
[2025-07-14T10:32:55Z] [INFO] Matching complete: 2/31 matches found
[2025-07-14T10:32:56Z] [INFO] Telegram: notification sent for "Senior Node.js Developer"
[2025-07-14T10:32:56Z] [INFO] Telegram: notification sent for "Full Stack Engineer"
[2025-07-14T10:32:56Z] [INFO] === Scan run completed: 9f3a1b2c === { newJobs: 31, matches: 2, notifications: 2 }
```

---

## Limitations

This is a personal automation tool, not a SaaS product. A few things to be aware of before running it:

| Limitation | Detail |
|-----------|--------|
| **LinkedIn scraping is unreliable** | LinkedIn actively detects and blocks bots. Expect frequent failures; the scraper is intentionally isolated so other portals still run. For best results, provide `LINKEDIN_SEARCH_URL` with pre-filtered criteria. |
| **Portal API stability** | JustJoin.it and NoFluffJobs APIs are public but undocumented. Selectors and endpoints may change without notice. |
| **Pracuj.pl selectors may drift** | Pracuj.pl CSS selectors are scraped from the live HTML. A UI redesign can break parsing; check the scraper if offers stop appearing. |
| **Email apply requires listing email** | Not all job offers include a direct apply email. If `applyEmail` is null and `EMAIL_APPLY_FALLBACK` is empty, the button shows an error. The fallback is to visit the job URL manually. |
| **GPT-4o cost** | Each matching call costs ~$0.01–0.03. With `MATCH_MAX_PER_RUN=50` and an hourly cron, daily cost is under $1.50 in most cases. Set `MATCH_MAX_PER_RUN` lower if cost is a concern. |
| **No persistent state beyond dedup** | The Telegram `pendingJobsMap` is in-memory. If the process restarts between a notification and the user clicking "Apply", the job lookup fails. Restart `npm run start` to recover. |
| **Single-user design** | Designed for one person's CV and one Telegram chat. Multi-user support would require a database and auth layer. |

---

## Key Design Decisions

**Why sequential GPT-4o calls instead of batching?**
One structured JSON call per offer yields higher-quality reasoning than asking the model to evaluate 50 jobs in a single prompt. Total cost stays bounded by `MATCH_MAX_PER_RUN`.

**Why SHA-256 for deduplication?**
Normalises IDs across portals that use inconsistent formats (slugs, numerics, UUIDs). Fixed 64-char strings keep `seen-jobs.json` compact indefinitely.

**Why is LinkedIn isolated?**
LinkedIn aggressively detects automation. Any unhandled exception inside `linkedin-scraper.ts` is caught, logged, and returns `[]` — other portals are unaffected.

**Why polling mode for Telegram?**
This tool runs locally or on a cheap VPS without a public domain or TLS. Polling requires zero infrastructure — callback latency is under 1 second, which is acceptable.

---

## License

MIT — see [LICENSE](LICENSE)
