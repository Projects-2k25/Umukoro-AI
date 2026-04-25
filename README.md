# Umukoro AI — AI-Powered Talent Screening

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

Umukoro AI is built on a **microservice architecture wired together with gRPC**. Three independently deployable services — a Next.js frontend, a NestJS backend, and a Python AI service — each own a single bounded responsibility, scale independently, and communicate over well-defined contracts: REST/JSON between client and backend, and **gRPC over HTTP/2 (with a JSON/HTTP fallback)** between backend and AI service. MongoDB persists all domain state; the AI service is stateless.

```
┌────────────────────┐    REST/JSON     ┌────────────────────┐    gRPC (HTTP/2)    ┌─────────────────────┐
│  Next.js 16        │  ───────────────>│  NestJS 10         │  ──────────────────>│  Python FastAPI      │
│  Frontend          │   Bearer JWT     │  + Mongoose        │   protobuf binary   │  + gRPC server       │
│  (port 7001)       │<───────────────  │  (port 3000)       │<──────────────────  │  (8000 HTTP / 50051) │
│  Redux Toolkit     │                  │  REST + gRPC client│   HTTP fallback     │  LangGraph + LLM     │
│  Recharts          │                  │                    │   (port 8000)       │                      │
└────────────────────┘                  └─────────┬──────────┘                     └──────────┬──────────┘
                                                  │                                           │
                                                  ▼                                           ▼
                                        ┌────────────────────┐                     ┌─────────────────────┐
                                        │  MongoDB 7         │                     │  Gemini 2.0 Flash    │
                                        │  jobs / applicants │                     │  (or Claude)         │
                                        │  screenings/results│                     │  via LangChain       │
                                        └────────────────────┘                     └─────────────────────┘
```

### Service responsibilities

| Service | Role | Stateful? |
|---------|------|-----------|
| **Frontend** ([frontend/](frontend/)) | UI, form orchestration, file uploads, dashboards, chart rendering. Holds JWT in `localStorage` and ships it with every request. | No (client state only) |
| **Backend** ([backend/](backend/)) | Source of truth — auth, job/applicant CRUD, file parsing (PDF/CSV/Excel), screening orchestration, persistence. Owns MongoDB. | Yes |
| **AI Service** ([ai-service/](ai-service/)) | Pure inference — runs the LangGraph screening workflow and resume extraction against an LLM. No DB, no auth. | No |

### Frontend ↔ Backend (REST/JSON)

The frontend uses an Axios client ([frontend/src/lib/api.ts](frontend/src/lib/api.ts)) with two interceptors:
- **Request:** attaches `Authorization: Bearer <jwt>` from `localStorage`
- **Response:** on `401`, clears the token and redirects to `/login`

State on the client side is managed with **Redux Toolkit** ([frontend/src/store/](frontend/src/store/)) — slices for auth, jobs, applicants, and screenings — and Recharts renders the radar/distribution charts on the screening result page. All routes are App-Router pages under [frontend/src/app/](frontend/src/app/).

The backend exposes a versioned REST API at `/api/v1/...`, documented via Swagger at [http://localhost:3000/api-docs](http://localhost:3000/api-docs). NestJS guards (JWT + role) protect every recruiter-scoped route, and the `recruiterId` from the JWT scopes every Mongo query.

### Backend ↔ AI Service (gRPC, with HTTP fallback)

The AI service is reached **primarily over gRPC**, with a JSON/HTTP fallback so local dev never blocks on protobuf codegen.

**Contract** — a single `.proto` file shared by both services: [proto/screening_service.proto](proto/screening_service.proto). It defines three RPCs:

```proto
service ScreeningService {
  rpc ScreenCandidates(ScreenCandidatesRequest) returns (ScreenCandidatesResponse);
  rpc ExtractResume(ExtractResumeRequest)       returns (ExtractResumeResponse);
  rpc HealthCheck(HealthCheckRequest)           returns (HealthCheckResponse);
}
```

The proto is the single source of truth — Node consumes it at runtime via `@grpc/proto-loader`, Python consumes generated `*_pb2` stubs.

**Why gRPC for this hop:**
- Strong, code-generated types across language boundaries (TS ↔ Python)
- HTTP/2 multiplexing + binary protobuf — meaningfully faster than JSON for the ~100-candidate payloads we send during screening
- Built-in deadlines, keepalive, and streaming primitives if we ever need them
- Natural fit for an internal, trusted, server-to-server hop where REST adds no value

**Backend client** ([backend/src/grpc/grpc.module.ts](backend/src/grpc/grpc.module.ts), [backend/src/grpc/screening-service.client.ts](backend/src/grpc/screening-service.client.ts)) — uses NestJS `ClientsModule` with `Transport.GRPC`, configured with:
- `url` — `AI_SERVICE_GRPC_URL` (default `localhost:50051`)
- 120-second timeout (screening can take 5-15s and we want headroom)
- 10MB max message size on both ends (large candidate batches)
- Keepalive every 30s with 5s timeout (keeps the connection warm during quiet periods)
- 1 retry with 3s backoff on transient failures
- Camel-case ↔ snake-case mapping in both directions (the proto uses snake_case, the rest of the codebase uses camelCase)

**AI server** ([ai-service/app/grpc/server/grpc_server.py](ai-service/app/grpc/server/grpc_server.py), [ai-service/app/grpc/server/screening_grpc_service.py](ai-service/app/grpc/server/screening_grpc_service.py)) — `grpc.aio` async server starts inside FastAPI's lifespan, on port `50051`, **alongside** the FastAPI HTTP app on `8000`. Both transports map to the same underlying `run_screening` / `extract_resume` functions, so REST and gRPC are functionally equivalent.

**Fallback path** — [backend/src/modules/screenings/screenings.service.ts](backend/src/modules/screenings/screenings.service.ts) tries gRPC first; on failure (no service, error response, or timeout) it logs a warning and POSTs the same payload to `http://ai-service:8000/api/v1/screen` via Axios. This keeps the system bootable even if the proto stubs aren't built locally.

### AI service internals

```
FastAPI (HTTP) ──┐
                 ├──> screening_workflow.run_screening ──> ScreeningWorkflowService.run
gRPC server   ───┘                                                    │
                                                                      ▼
                                                          LangGraph StateGraph
```

**Tools used inside the AI service:**
- **FastAPI + Uvicorn** — HTTP transport for [POST /api/v1/screen](ai-service/app/api/screening_router.py) and [POST /api/v1/extract-resume](ai-service/app/api/screening_router.py)
- **grpc.aio** — async gRPC server, started in the FastAPI `lifespan` hook so a single Python process serves both transports
- **LangChain** — provider-agnostic chat model abstraction. [ai-service/app/core/llm/langchain_llm.py](ai-service/app/core/llm/langchain_llm.py) returns either `ChatGoogleGenerativeAI` (Gemini) or `ChatAnthropic` (Claude) depending on `LLM_PROVIDER`. The rest of the code is provider-blind — it only sees `SystemMessage` / `HumanMessage` and `.ainvoke()`.
- **LangGraph** — orchestrates the multi-step screening workflow as an explicit state machine ([ai-service/app/services/screening_graph.py](ai-service/app/services/screening_graph.py))
- **Pydantic v2** — request/response schemas, validated at both the FastAPI and gRPC boundaries
- **Instructor / structured prompts** — every LLM call returns JSON; we strip ```json fences and `json.loads` the result

**The LangGraph screening workflow:**

```
        ┌───────────────────┐
        │  batch_evaluate   │◄──┐  (loops until all candidates evaluated)
        └─────────┬─────────┘   │
                  │             │
            all batches done?───┘
                  │ yes
                  ▼
        ┌───────────────────┐
        │  compute_scores   │   pure logic — weighted composite (no LLM)
        └─────────┬─────────┘
                  ▼
        ┌───────────────────┐
        │  rank_shortlist   │   sort, slice top N, assign STRONG_YES/YES/MAYBE/NO
        └─────────┬─────────┘
                  │
        all scores < 40? ──── yes ──┐
                  │ no              │
                  ▼                 ▼
        ┌───────────────────┐  ┌───────────────────┐
        │ generate_reasoning│─>│  build_response   │──> END
        └───────────────────┘  └───────────────────┘
```

The graph is a `StateGraph` over a typed `ScreeningGraphState` ([ai-service/app/services/screening_state.py](ai-service/app/services/screening_state.py)) carrying job, candidates, config, intermediate evaluations, batch index, and outputs. Two conditional edges drive control flow: a self-loop on `batch_evaluate` until all candidate batches (size 10) are processed, and a skip on `rank_shortlist` that bypasses reasoning generation when nobody scored ≥ 40 (saves an LLM call).

Why a graph instead of a straight script? Three reasons:
1. **Batching is naturally a loop** — the conditional edge pattern lets us keep state cleanly across iterations.
2. **Cheap branches stay cheap** — score computation and ranking are pure Python and never hit the LLM, but they live in the same workflow.
3. **Observability** — every node transition is loggable and (in future) checkpointable for retries/resume.

### End-to-end request: "Screen this job"

```
1.  Recruiter clicks "Run Screening" in the UI
2.  Frontend  ── POST /api/v1/screenings (jobId, config) + JWT ──>  Backend
3.  Backend   verifies JWT, loads Job + all Applicants from MongoDB
4.  Backend   creates a Screening doc with status=PROCESSING
5.  Backend   ── gRPC ScreenCandidates(job, candidates, config) ──>  AI Service
                  └── on failure ──> POST /api/v1/screen (HTTP fallback)
6.  AI Service runs LangGraph:
        batch_evaluate (loop) → compute_scores → rank_shortlist
        → generate_reasoning → build_response
7.  AI Service  ── ScreenCandidatesResponse (ranked + reasoning) ──>  Backend
8.  Backend   persists ScreeningResult docs, marks Screening COMPLETED,
              records aiModel + processingTimeMs
9.  Backend   ── 200 OK { screening, results } ──>  Frontend
10. Frontend  navigates to /screenings/[id] and renders charts
```

The whole call is synchronous — the HTTP request from the frontend stays open for the full 5-15s. This is intentional for hackathon simplicity; production would queue step 5 and stream results back over websockets or poll a status endpoint.

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

| Field | Value |
|----------|-----------|
| Email | `demo@umukoroai.com` |
| Password | `Demo123!` |

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
| GEMINI_API_KEY | Google Gemini API key (required) |
| GEMINI_MODEL | Gemini model (default: gemini-2.0-flash) |

## API Documentation

Backend Swagger docs available at `http://localhost:3000/api-docs`

## Assumptions & Limitations

- **Screening is synchronous** — For hackathon simplicity, the screening API call blocks until AI processing completes (5-15s for up to 50 candidates)
- **No file storage** — PDF resumes are parsed in-memory; text is stored but original files are not persisted
- **Single-tenant** — No multi-organization support; designed for single-recruiter use
- **Gemini rate limits** — Large candidate pools (100+) may hit API rate limits; batches of 10 mitigate this
- **Scoring calibration** — AI scores are relative within a screening, not absolute across different screenings

## Team

Built by the ZenX team for the Umurava AI Hackathon 2026.
