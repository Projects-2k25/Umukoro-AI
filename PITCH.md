# Umukoro AI

**AI-powered talent screening for African recruiters.**
Built for the Umurava AI Hackathon — "Building AI Products for the Human Resources Industry."

---

## Slide 1 — The problem & our answer

### The hiring bottleneck

Recruiters in Rwanda — and across the continent — drown in unstructured applicants. A single open role pulls hundreds of CVs across PDFs, spreadsheets, LinkedIn exports, and walk-in referrals. The first 80% of any hire is **reading, comparing, and ranking** — work that is repetitive, biased, and slow.

The cost is concrete:

- **Time:** ~15 minutes of human review per CV. 200 applicants → a full work week before the first interview.
- **Inconsistency:** the candidate reviewed at 9 AM is judged differently than the one at 5 PM.
- **Hidden bias:** name, school, gender, and location quietly skew shortlists in ways no one can audit.
- **Lost candidates:** great profiles buried in the pile never get a fair read.

### Our answer: Umukoro AI

A recruiter creates a job, drops in applicants from any source, and gets back a **ranked, scored, explainable shortlist in minutes** — not days.

| What recruiters do | What Umukoro AI does |
|---|---|
| Define the role | Captures structured requirements: skills (with weights), experience, education |
| Ingest applicants | Accepts JSON profiles, CSV/Excel sheets, or raw PDF resumes — auto-extracted with an LLM |
| Click "Screen Candidates" | Runs every applicant against the role across 4 dimensions: Skills, Experience, Education, Relevance |
| Review the shortlist | Top N candidates ranked by composite score with **Strong Yes / Yes / Maybe / No** recommendations |
| Justify decisions | Every score comes with strengths, gaps, risks, and a written rationale — auditable and bias-checkable |

### Why now

LLMs are finally cheap enough and structured enough (Gemini 2.0 Flash, Claude) to grade hundreds of CVs in parallel for cents — while still producing the kind of *reasoned* output an HR manager can defend in a hiring committee. Two years ago this product was either expensive or hallucinating. Today it's neither.

---

## Slide 2 — Product, architecture & traction

### What we built (and what already works)

- **Multi-source ingestion** — Umurava JSON, CSV/Excel uploads with LLM-driven header mapping, and PDF resume extraction
- **Transparent scoring** — 4-dimensional rubric with configurable weights per role
- **Ranked shortlists** — visual radar charts, score distributions, and per-candidate reasoning
- **Async, scalable screening** — non-blocking screening jobs, live progress, parallel batch evaluation
- **Production-ready** — JWT auth, role-based access, MongoDB persistence, Swagger API docs, gRPC + REST fallback

### Architecture: three services, one contract

```
Next.js  ──REST/JSON──▶  NestJS  ──gRPC (HTTP/2)──▶  Python AI service
frontend                 backend     + HTTP fallback   FastAPI + LangGraph
                            │                                │
                            ▼                                ▼
                         MongoDB                        Gemini / Claude
```

Three independently deployable services, each with one job. The backend never talks to the LLM directly — that boundary lets us swap models, add evaluators, or scale the AI service horizontally without touching recruiter-facing code.

### How we scaled it (what makes 500+ applicants viable)

The naive screening flow timed out around 24 candidates. We fixed it in three layers:

1. **Parallel batch evaluation** — `asyncio.gather` with a semaphore-bounded fan-out across LLM batches. Linear speedup with batch count, capped to respect provider rate limits.
2. **Async screening jobs** — `POST /screenings` returns immediately; work runs in the background; the UI polls for status with a live progress bar. The browser is no longer in the critical path.
3. **Slim prompts** — dropped redundant resume text when structured fields exist. Roughly halved per-batch LLM latency.

Result: **24 candidates, ~30s. 500 candidates, ~2–4 minutes** — instead of the previous 12–20 minutes (when it didn't time out entirely).

### Why this wins

- **Africa-first design.** Built for Umurava-style talent profiles, multi-source data, and recruiters who don't have ATS budgets.
- **Explainable, not magical.** Every score is defensible. Recruiters and candidates both win.
- **Model-agnostic.** Gemini today, Claude tomorrow, open-source on-prem the day after. The contract is the prompt, not the provider.
- **Already shipping.** End-to-end working product — sign up, create a job, upload 100 CVs, get a ranked shortlist with rationale. Live demo available.

### Where we go next

| Horizon | Initiative |
|---|---|
| **Now** | Polish, scale to 1,000+ applicants per screening, recruiter feedback loops |
| **Next 3 months** | Bias auditing dashboard, candidate-facing explanations, integration with Umurava's talent pool |
| **6–12 months** | Interview question generation, candidate outreach drafts, multi-tenant SaaS for African HR consultancies |

**Ask:** design partners (recruiters willing to run real hiring loops on Umukoro AI), an Umurava data-sharing partnership, and feedback from HR practitioners on what *should not* be automated.

---

*Built by the Umukoro AI team for the Umurava AI Hackathon — 2026.*
