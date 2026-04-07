# TalentLens — AI-Powered Talent Screening

An intelligent recruitment screening tool that uses Google Gemini AI to analyze, score, and rank job applicants with transparent, explainable reasoning.

Built for the **Umurava AI Hackathon** — "Building AI Products for the Human Resources Industry."

## Features

- **Job Management** — Create jobs with detailed requirements, skills (with importance weights), experience levels, and education criteria
- **Multi-Source Applicant Ingestion** — Import structured Umurava talent profiles (JSON), upload CSV/Excel spreadsheets, or upload individual PDF resumes
- **AI-Powered Screening** — Gemini 2.0 Flash evaluates all candidates against job requirements across 4 dimensions: Skills, Experience, Education, and Role Relevance
- **Ranked Shortlists** — Top 10/20 candidates ranked by composite score with recommendation labels (Strong Yes / Yes / Maybe / No)
- **Transparent AI Reasoning** — Every score includes specific strengths, gaps, risks, and a natural-language explanation per candidate
- **Visual Score Analytics** — Radar charts, score distribution bars, color-coded progress indicators

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  Next.js     │────>│  NestJS Backend  │────>│  Python FastAPI   │
│  Frontend    │     │  + MongoDB       │     │  + Gemini AI      │
│  (Port 7001) │<────│  (Port 3000)     │<────│  (Port 8000)      │
└─────────────┘     └─────────────────┘     └──────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS, Redux Toolkit, Recharts |
| Backend | NestJS 10, MongoDB (Mongoose), JWT Auth, Swagger |
| AI Service | Python FastAPI, Google Gemini 2.0 Flash (primary), LangChain, LangGraph |
| Bonus | Multi-LLM support — Claude (Anthropic) available as an alternative provider |
| Infrastructure | Docker Compose, MongoDB 7 |

## AI Decision Flow

1. **Job Analysis** — Gemini parses the job description into structured must-have vs nice-to-have requirements
2. **Batch Evaluation** — Candidates are evaluated in batches of 10 across 4 scored dimensions using structured JSON output
3. **Weighted Scoring** — Composite score = Skills (30%) + Experience (25%) + Education (20%) + Relevance (25%)
4. **Ranking & Classification** — Candidates sorted by score; top N shortlisted with recommendation labels
5. **Reasoning Generation** — Gemini writes 2-3 sentence recruiter-friendly explanations for each shortlisted candidate

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.11+
- MongoDB 7+ (local or Atlas)
- Google Gemini API key

### 1. Backend
```bash
cd backend
cp .env.example .env   # Edit with your MongoDB URI
npm install
npm run seed           # Seed demo data
npm run start:dev      # Starts on port 3000
```

### 2. AI Service
```bash
cd ai-service
cp .env.example .env   # Add your GEMINI_API_KEY
pip install -r requirements.txt
python -m app.main     # Starts on port 8000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev            # Starts on port 7001
```

### Docker Compose (all services)
```bash
GEMINI_API_KEY=your-key docker compose up
```

### Demo Login
```
Email: demo@talentlens.ai
Password: Demo123!
```

## Environment Variables

### Backend (.env)
| Variable | Description |
|----------|-----------|
| MONGODB_URI | MongoDB connection string |
| JWT_SECRET | JWT signing secret |
| AI_SERVICE_URL | AI service URL (default: http://localhost:8000) |
| CLIENT_URL | Frontend URL for CORS |

### AI Service (.env)
| Variable | Description |
|----------|-----------|
| LLM_PROVIDER | LLM provider to use: `gemini` (default) or `claude` |
| GEMINI_API_KEY | Google Gemini API key (required if provider is gemini) |
| GEMINI_MODEL | Gemini model (default: gemini-2.0-flash) |
| ANTHROPIC_API_KEY | Anthropic API key (required if provider is claude) |
| CLAUDE_MODEL | Claude model (default: claude-sonnet-4-20250514) |

## API Documentation

Backend Swagger docs available at `http://localhost:3000/api-docs`

## Assumptions & Limitations

- **Screening is synchronous** — For hackathon simplicity, the screening API call blocks until AI processing completes (5-15s for up to 50 candidates)
- **No file storage** — PDF resumes are parsed in-memory; text is stored but original files are not persisted
- **Single-tenant** — No multi-organization support; designed for single-recruiter use
- **Gemini rate limits** — Large candidate pools (100+) may hit API rate limits; batches of 10 mitigate this. Switch to Claude via `LLM_PROVIDER=claude` as a fallback
- **Scoring calibration** — AI scores are relative within a screening, not absolute across different screenings

## Team

Built by the ZenX team for the Umurava AI Hackathon 2026.
