# Application Portfolio Rationalizer

Production-oriented monorepo for application portfolio rationalization using Angular, LangGraph and PostgreSQL.

## Architecture

- Angular 22 standalone frontend with Business, Technology and Operations tabs
- Node.js and Express REST API
- LangGraph.js workflow for validation, averages, weighted scoring, TIME classification and recommendations
- PostgreSQL for client and assessment history
- Docker multi-stage image serving the Angular build from the API container
- Railway/Render deployment configuration for the web service and managed PostgreSQL

The scoring model uses Business 40%, Technology 35% and Operations 25%. The overall threshold is above 5. TIME recommendations use business value and combined technology and operational health.

This is a custom implementation inspired by the Gartner TIME model. It is not an official Gartner scoring formula.

## Local development

```bash
npm install
docker compose up db -d
cp .env.example .env
npm run dev:server
npm run dev:client
```

Open http://localhost:4200. Angular proxies API calls to port 3000.

## Complete stack with Docker

```bash
docker compose up --build
```

Open http://localhost:3000. PostgreSQL data is stored in the named Docker volume.

## Deploy to Render

1. Push this repository to GitHub.
2. In Render, select **New → Blueprint**.
3. Connect the GitHub repository.
4. Render reads `render.yaml` and creates the Docker web service and PostgreSQL database.
5. Confirm the proposed paid plans or change them in `render.yaml` before deployment.

The application listens on Render's `PORT`, reads `DATABASE_URL`, applies idempotent schema migrations at startup and exposes `/api/health`.

## Deploy to Railway

1. Create a Railway project and deploy this GitHub repository using its root `Dockerfile`.
2. Add a managed PostgreSQL service to the same project.
3. Set the application service variable `DATABASE_URL=${{Postgres.DATABASE_URL}}`.
4. Configure `/api/health` as the health-check path and generate a public domain.

Railway supplies `PORT` automatically. The container binds to `0.0.0.0` and serves both the Angular application and REST API.

## API

- `GET /api/health`
- `GET /api/portfolio`
- `POST /api/agent/analyze`
- `POST /api/assessments`

## LangGraph flow

`START → validateInput → domainAverages → weightedCalculation → timeClassification → recommendationExplanation → END`

Numeric scoring remains deterministic and auditable. An optional LLM node can later enrich narrative recommendations without changing the authoritative score.

## Verification

```bash
npm test
npm run build
```
