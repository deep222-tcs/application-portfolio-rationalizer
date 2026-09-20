export type Domain = "business" | "technology" | "operations";
export type Scores = Record<Domain, number[]>;
export type Recommendation = "Tolerate" | "Invest" | "Migrate" | "Eliminate";
export interface AssessmentInput {
  clientName: string;
  clientIndustry: string;
  applicationName: string;
  owner: string;
  scores: Scores;
}
export interface AgentResult {
  averages: Record<Domain, number>;
  weightedScore: number;
  thresholdPassed: boolean;
  recommendation: Recommendation;
  rationale: string;
  modernizationActions: string[];
  completedNodes: string[];
}
