import pg from "pg";
import type { AgentResult, AssessmentInput } from "./types.js";

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export async function migrate() {
  await pool.query(`
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
  `);
}

export async function saveAssessment(input: AssessmentInput, result: AgentResult) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const clientRow = await client.query(
      `INSERT INTO clients(name, industry) VALUES($1, $2)
       ON CONFLICT(name) DO UPDATE SET industry = EXCLUDED.industry, updated_at = NOW()
       RETURNING id`,
      [input.clientName, input.clientIndustry],
    );
    const app = await client.query(
      `INSERT INTO applications(
        client_id, name, owner, scores, domain_averages, weighted_score,
        threshold_passed, recommendation, rationale, modernization_actions, agent_trace
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [
        clientRow.rows[0].id, input.applicationName, input.owner,
        input.scores, result.averages, result.weightedScore,
        result.thresholdPassed, result.recommendation, result.rationale,
        result.modernizationActions, result.completedNodes,
      ],
    );
    await client.query("COMMIT");
    return app.rows[0].id;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listPortfolio() {
  const { rows } = await pool.query(`
    SELECT a.id, c.name AS "clientName", c.industry AS "clientIndustry",
      a.name AS "applicationName", a.owner, a.scores,
      a.domain_averages AS "averages", a.weighted_score::float AS "weightedScore",
      a.threshold_passed AS "thresholdPassed", a.recommendation, a.rationale,
      a.modernization_actions AS "modernizationActions",
      a.agent_trace AS "completedNodes", a.updated_at AS "updatedAt"
    FROM applications a JOIN clients c ON c.id = a.client_id
    ORDER BY a.updated_at DESC LIMIT 250
  `);
  return rows;
}
