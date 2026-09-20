import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { assessmentSchema, runPortfolioAgent } from "./agent.js";
import { listPortfolio, migrate, pool, saveAssessment } from "./database.js";

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_request, response) => {
  await pool.query("SELECT 1");
  response.json({ status: "ok" });
});
app.get("/api/portfolio", async (_request, response, next) => {
  try { response.json({ applications: await listPortfolio() }); } catch (error) { next(error); }
});
app.post("/api/agent/analyze", async (request, response, next) => {
  try {
    const input = assessmentSchema.parse(request.body);
    response.json(await runPortfolioAgent(input));
  } catch (error) { next(error); }
});
app.post("/api/assessments", async (request, response, next) => {
  try {
    const input = assessmentSchema.parse(request.body);
    const result = await runPortfolioAgent(input);
    const id = await saveAssessment(input, result);
    response.status(201).json({ id, ...result });
  } catch (error) { next(error); }
});

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const staticDir = path.resolve(currentDir, "../../client-dist");
app.use(express.static(staticDir));
app.get("/{*path}", (_request, response) => response.sendFile(path.join(staticDir, "index.html")));

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) return response.status(400).json({ error: "Invalid assessment", issues: error.issues });
  console.error(error);
  return response.status(500).json({ error: "Unexpected server error" });
});

const port = Number(process.env.PORT ?? 3000);
await migrate();
app.listen(port, "0.0.0.0", () => console.log(`Portfolio Rationalizer listening on ${port}`));
