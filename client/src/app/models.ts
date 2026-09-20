export type Domain = "business" | "technology" | "operations";
export type Scores = Record<Domain, number[]>;
export interface Assessment {
  clientName: string; clientIndustry: string; applicationName: string; owner: string; scores: Scores;
}
export interface AgentResult {
  averages: Record<Domain, number>; weightedScore: number; thresholdPassed: boolean;
  recommendation: string; rationale: string; modernizationActions: string[]; completedNodes: string[];
}
export interface PortfolioRecord extends Assessment, AgentResult {
  id: number; updatedAt: string;
}
