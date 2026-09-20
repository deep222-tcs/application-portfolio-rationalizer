import json
import os

import psycopg
from psycopg.rows import dict_row

from .models import AgentResult, AssessmentInput


def _database_url() -> str:
    value = os.getenv("DATABASE_URL")
    if not value:
        raise RuntimeError("DATABASE_URL is required")
    return value


async def migrate() -> None:
    async with await psycopg.AsyncConnection.connect(_database_url()) as connection:
        async with connection.cursor() as cursor:
            await cursor.execute("""
                CREATE TABLE IF NOT EXISTS clients (
                  id BIGSERIAL PRIMARY KEY,
                  name TEXT NOT NULL UNIQUE,
                  industry TEXT NOT NULL DEFAULT '',
                  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS applications (
                  id BIGSERIAL PRIMARY KEY,
                  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
                  name TEXT NOT NULL,
                  owner TEXT NOT NULL DEFAULT '',
                  scores JSONB NOT NULL,
                  domain_averages JSONB NOT NULL,
                  weighted_score NUMERIC(4,2) NOT NULL,
                  threshold_passed BOOLEAN NOT NULL,
                  recommendation TEXT NOT NULL,
                  rationale TEXT NOT NULL,
                  modernization_actions JSONB NOT NULL,
                  agent_trace JSONB NOT NULL,
                  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS applications_client_id_idx ON applications(client_id);
            """)


async def healthcheck() -> None:
    async with await psycopg.AsyncConnection.connect(_database_url()) as connection:
        await connection.execute("SELECT 1")


async def save_assessment(assessment: AssessmentInput, result: AgentResult) -> int:
    async with await psycopg.AsyncConnection.connect(_database_url()) as connection:
        async with connection.cursor() as cursor:
            await cursor.execute(
                """INSERT INTO clients(name, industry) VALUES(%s, %s)
                   ON CONFLICT(name) DO UPDATE SET industry = EXCLUDED.industry, updated_at = NOW()
                   RETURNING id""",
                (assessment.client_name, assessment.client_industry),
            )
            client_id = (await cursor.fetchone())[0]
            await cursor.execute(
                """INSERT INTO applications(
                    client_id, name, owner, scores, domain_averages, weighted_score,
                    threshold_passed, recommendation, rationale, modernization_actions, agent_trace
                   ) VALUES(%s,%s,%s,%s::jsonb,%s::jsonb,%s,%s,%s,%s,%s::jsonb,%s::jsonb) RETURNING id""",
                (
                    client_id, assessment.application_name, assessment.owner,
                    assessment.scores.model_dump_json(), json.dumps(result.averages), result.weighted_score,
                    result.threshold_passed, result.recommendation, result.rationale,
                    json.dumps(result.modernization_actions), json.dumps(result.completed_nodes),
                ),
            )
            return (await cursor.fetchone())[0]


async def list_portfolio() -> list[dict]:
    async with await psycopg.AsyncConnection.connect(_database_url(), row_factory=dict_row) as connection:
        async with connection.cursor() as cursor:
            await cursor.execute("""
                SELECT a.id, c.name AS "clientName", c.industry AS "clientIndustry",
                  a.name AS "applicationName", a.owner, a.scores,
                  a.domain_averages AS averages, a.weighted_score::float AS "weightedScore",
                  a.threshold_passed AS "thresholdPassed", a.recommendation, a.rationale,
                  a.modernization_actions AS "modernizationActions",
                  a.agent_trace AS "completedNodes", a.updated_at AS "updatedAt"
                FROM applications a JOIN clients c ON c.id = a.client_id
                ORDER BY a.updated_at DESC LIMIT 250
            """)
            return await cursor.fetchall()
