export function buildCvParsingPrompt(rawText: string): string {
  return `You are a precise CV parser. Extract structured information from the CV text below.

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "candidateName": "string",
  "email": "string",
  "phone": "string or null",
  "location": "string or null",
  "yearsExperience": number or null,
  "roles": [
    {
      "title": "string",
      "company": "string",
      "startYear": number or null,
      "endYear": number or null,
      "description": "string"
    }
  ],
  "skills": ["string"],
  "languages": ["string (e.g. English C1, Polish native)"],
  "education": [
    {
      "degree": "string",
      "institution": "string",
      "year": number or null
    }
  ],
  "summary": "string or null"
}

Rules:
- Extract ALL skills mentioned (technologies, tools, frameworks, methodologies)
- roles: order from most recent to oldest
- yearsExperience: calculate from first role start year to now; null if unclear
- summary: the candidate's own profile/objective text if present, otherwise null
- Do not infer or hallucinate information not present in the CV text

CV TEXT:
---
${rawText}
---`;
}
