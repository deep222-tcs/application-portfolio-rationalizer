import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import type { AgentResult, AssessmentInput, Recommendation } from "./types.js";

const scoreList = z.array(z.number().int().min(1).max(10)).length(5);
export const assessmentSchema = z.object({
  clientName: z.string().trim().min(1),
  clientIndustry: z.string().trim().default(""),
  applicationName: z.string().trim().min(1),
  owner: z.string().trim().default(""),
  scores: z.object({
    business: scoreList,
    technology: scoreList,
    operations: scoreList,
  }),
});

const AgentState = Annotation.Root({
  input: Annotation<AssessmentInput>,
  averages: Annotation<AgentResult["averages"]>,
  weightedScore: Annotation<number>,
  thresholdPassed: Annotation<boolean>,
  recommendation: Annotation<Recommendation>,
  rationale: Annotation<string>,
  modernizationActions: Annotation<string[]>,
  completedNodes: Annotation<string[]>({
    reducer: (left, right) => [...(left ?? []), ...(right ?? [])],
    default: () => [],
  }),
});

const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const validate = (state: typeof AgentState.State) => ({
  input: assessmentSchema.parse(state.input),
  completedNodes: ["validate"],
});

const calculateAverages = (state: typeof AgentState.State) => ({
  averages: {
    business: mean(state.input.scores.business),
    technology: mean(state.input.scores.technology),
    operations: mean(state.input.scores.operations),
  },
  completedNodes: ["calculate-averages"],
});

const calculateWeightedScore = (state: typeof AgentState.State) => {
  const score =
    state.averages.business * 0.4 +
    state.averages.technology * 0.35 +
    state.averages.operations * 0.25;
  return {
    weightedScore: Number(score.toFixed(2)),
    thresholdPassed: score > 5,
    completedNodes: ["calculate-weighted-score"],
  };
};

const classifyTime = (state: typeof AgentState.State) => {
  const health = (state.averages.technology + state.averages.operations) / 2;
  let recommendation: Recommendation;
  if (state.averages.business >= 6 && health >= 6) recommendation = "Invest";
  else if (state.averages.business >= 6) recommendation = "Migrate";
  else if (health >= 6) recommendation = "Tolerate";
  else recommendation = "Eliminate";
  return { recommendation, completedNodes: ["classify-time"] };
};

const explain = (state: typeof AgentState.State) => {
  const explanations: Record<Recommendation, string> = {
    Invest: "High business value and healthy technology and operations support further investment.",
    Migrate: "High business value with technology or operational constraints supports modernization.",
    Tolerate: "Lower business value with acceptable platform health supports controlled continuation.",
    Eliminate: "Lower business value and weak platform health support consolidation or retirement.",
  };
  const actions: Record<Recommendation, string[]> = {
    Invest: ["Fund product enhancements", "Increase automation", "Protect reliability objectives"],
    Migrate: ["Define target architecture", "Plan phased migration", "Address resilience gaps"],
    Tolerate: ["Control operating cost", "Limit discretionary change", "Monitor lifecycle risk"],
    Eliminate: ["Confirm business dependencies", "Archive required data", "Execute retirement plan"],
  };
  return {
    rationale: explanations[state.recommendation],
    modernizationActions: actions[state.recommendation],
    completedNodes: ["generate-recommendation"],
  };
};

const graph = new StateGraph(AgentState)
  .addNode("validateInput", validate)
  .addNode("domainAverages", calculateAverages)
  .addNode("weightedCalculation", calculateWeightedScore)
  .addNode("timeClassification", classifyTime)
  .addNode("recommendationExplanation", explain)
  .addEdge(START, "validateInput")
  .addEdge("validateInput", "domainAverages")
  .addEdge("domainAverages", "weightedCalculation")
  .addEdge("weightedCalculation", "timeClassification")
  .addEdge("timeClassification", "recommendationExplanation")
  .addEdge("recommendationExplanation", END)
  .compile();

export async function runPortfolioAgent(input: AssessmentInput): Promise<AgentResult> {
  const result = await graph.invoke({ input });
  return {
    averages: result.averages,
    weightedScore: result.weightedScore,
    thresholdPassed: result.thresholdPassed,
    recommendation: result.recommendation,
    rationale: result.rationale,
    modernizationActions: result.modernizationActions,
    completedNodes: result.completedNodes,
  };
}
