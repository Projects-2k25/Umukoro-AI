BATCH_EVALUATION_PROMPT = """You are an expert talent acquisition specialist evaluating candidates for a job position.

## Job Requirements
Title: {job_title}
Description: {job_description}

### Required Skills (importance 1-5, 5 = most important):
{formatted_skills}

### Experience Requirements:
- Level: {experience_level}
- Years: {min_years} - {max_years} years

### Education Requirements:
{formatted_education}

{custom_instructions}

## Candidates to Evaluate
{formatted_candidates}

## Instructions
Evaluate EACH candidate against the job requirements across these dimensions:
1. **Skills Match** (0-100): How well do the candidate's skills match required skills? Consider skill level (Beginner/Intermediate/Advanced/Expert) and years of experience. Weight hard requirements heavily. Partial matches get partial credit.
2. **Experience Match** (0-100): Does their experience level and years match? Consider career progression, relevance of past roles, and technologies used in each role.
3. **Education Match** (0-100): Does education meet requirements? Consider both formal degrees and relevant certifications.
4. **Role Relevance** (0-100): How relevant is their overall profile to THIS specific role? Consider industry fit, project portfolio, transferable skills, and availability.

For each candidate provide:
- Scores for all 4 dimensions (0-100 integer)
- 2-4 specific strengths (concrete facts from their profile)
- 1-3 gaps or risks (honest assessment, not generic filler)
- Brief dimension analysis with rationale for each score

Be fair, evidence-based, and avoid bias. Score based on qualifications, not demographics. A candidate with 0 relevant skills should score near 0, not 50.
"""

REASONING_SUMMARY_PROMPT = """You are writing brief recruiter-facing summaries explaining why each candidate was shortlisted for the role of "{job_title}".

For each candidate below, write a 2-3 sentence explanation that:
- Leads with their strongest qualification match
- Mentions any notable risk or gap the recruiter should probe in an interview
- Uses professional, concise language (no AI-sounding filler like "demonstrates" or "showcases")

{formatted_candidates_with_scores}
"""

RESUME_EXTRACTION_PROMPT = """Extract structured profile information from this resume text. Be thorough but accurate - only extract information that is clearly stated.

Resume text:
{resume_text}

Extract the following fields according to the Talent Profile Schema:

**Basic Information:**
- firstName, lastName, email
- headline (short professional summary, e.g. "Backend Engineer – Node.js & AI Systems")
- bio (detailed professional biography if present)
- location (City, Country)

**Skills & Languages:**
- skills: list of skills with level (Beginner | Intermediate | Advanced | Expert) and estimated yearsOfExperience
- languages: list of spoken languages with proficiency (Basic | Conversational | Fluent | Native)

**Work Experience:**
- experience: list of positions with company, role, startDate (YYYY-MM), endDate (YYYY-MM or "Present"), description, technologies used, and isCurrent flag

**Education:**
- education: list with institution, degree (e.g. "Bachelor's", "Master's", "PhD"), fieldOfStudy, startYear, endYear

**Certifications:**
- certifications: list with name, issuer, issueDate (YYYY-MM)

**Projects:**
- projects: list with name, description, technologies, role, link (if available), startDate, endDate

**Availability:**
- availability: status (Available | Open to Opportunities | Not Available), type (Full-time | Part-time | Contract)

**Social Links:**
- socialLinks: linkedin, github, portfolio URLs if present

**Internal fields:**
- phone, totalExperienceYears (calculated from work history), currentTitle, currentCompany
"""
